import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

// 설치 없이 Node 안에서 도는 Postgres(PGlite)로 마이그레이션·seed 를 적용하고
// 규칙이 실제로 지켜지는지 확인한다. Supabase 의 auth 스키마와 역할은 아래에서 흉내 낸다.
//
//   cd supabase/tests && npm install && npm test
//   SHOW=1 npm test   # 거부될 때 나오는 에러 문구까지 보기

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sup = join(repo, "supabase");
const data = join(repo, "apps", "web", "data");
const json = (f) => JSON.parse(readFileSync(join(data, f), "utf8"));

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra); }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function expectError(name, fn, pattern) {
  try {
    await fn();
    ok(name, false, "(에러가 나야 하는데 성공함)");
  } catch (e) {
    const m = String(e.message);
    ok(name, !pattern || pattern.test(m), "→ " + m);
    if (process.env.SHOW) console.log("      ↳", m);
  }
}

const UID = {
  A: "00000000-0000-0000-0000-00000000000a", // 팀원 admin
  B: "00000000-0000-0000-0000-00000000000b", // 팀원 member
  C: "00000000-0000-0000-0000-00000000000c", // 로그인했지만 팀원 아님
  U: "00000000-0000-0000-0000-0000000000f1", // 일반 사용자
  V: "00000000-0000-0000-0000-0000000000f2", // 다른 일반 사용자
};
async function as(who) {
  await db.exec("reset role");
  const sub = UID[who] ?? "";
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  if (who === "anon") await db.exec("set role anon");
  else if (who === "service") await db.exec("set role service_role");
  else if (who !== "postgres") await db.exec("set role authenticated");
}

// ── Supabase 흉내 ──
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

console.log("\n[마이그레이션 적용]");
for (const f of readdirSync(join(sup, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(sup, "migrations", f), "utf8"));
  console.log("  적용", f);
}
await db.exec(readFileSync(join(sup, "seed.sql"), "utf8"));
console.log("  적용 seed.sql");

// ── 0. 정리 상태 ──
console.log("\n[0] 이름·설명");
const tables = await q(`select c.relname as name, c.relkind as kind, obj_description(c.oid, 'pg_class') as comment
                        from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname = 'public' and c.relkind in ('r', 'v') order by 1`);
ok(`표·뷰 ${tables.length}개 모두 data_ · team_ · stats_ · user_ 로 시작`, tables.every((t) => /^(data|team|stats|user)_/.test(t.name)),
   tables.map((t) => t.name).join(", "));
ok("모든 표·뷰에 설명이 있다", tables.every((t) => t.comment), tables.filter((t) => !t.comment).map((t) => t.name).join(", "));
const bare = await q(`select c.relname || '.' || a.attname as col
                      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
                        and a.attname <> 'id' and col_description(c.oid, a.attnum) is null`);
ok("모든 칸에 설명이 있다 (id 제외)", bare.length === 0, bare.map((b) => b.col).join(", "));
const metaOrder = await q(`select c.relname as t, array_agg(a.attname order by a.attnum) as cols
                           from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
                           where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
                             and c.relname in ('data_policies', 'data_loan_products', 'data_income_thresholds')
                           group by 1`);
ok("data_ 표의 관리 4칸이 같은 이름·순서로 맨 뒤에 있다",
   metaOrder.length === 3 && metaOrder.every((m) => m.cols.slice(-4).join() === "version,edited_at,edited_by,edit_note"));
const enums = await q(`select t.typname as name, obj_description(t.oid, 'pg_type') as comment
                       from pg_type t join pg_namespace n on n.oid = t.typnamespace
                       where n.nspname = 'public' and t.typtype = 'e' order by 1`);
ok(`선택지 타입 ${enums.length}개 모두 opt_ 로 시작하고 설명이 있다`,
   enums.length === 11 && enums.every((e) => e.name.startsWith("opt_") && e.comment), enums.map((e) => e.name).join(", "));
const textChoice = await q(`select c.relname || '.' || a.attname as col
                            from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0
                              and a.attname in ('status', 'role', 'result', 'action', 'event_name', 'benefit_type',
                                                'lump_sum_basis', 'product_type', 'required_inputs',
                                                'discovery_statuses', 'discovery_housing_types')
                              and format_type(a.atttypid, a.atttypmod) not like 'opt\\_%'`);
ok("정해진 값만 받는 칸은 모두 선택지 타입이다", textChoice.length === 0, textChoice.map((c) => c.col).join(", "));

// ── 1. 내보내기가 원본 JSON 과 같은가 ──
console.log("\n[1] export_*() == 현재 JSON");
await as("service");
const [ex] = await q(`select export_policies() p, export_loan_products() l, export_income_thresholds() t, export_income_brackets() b`);
ok("policies.json 과 같다", isDeepStrictEqual(ex.p, json("policies.json")));
ok("loan-products.json 과 같다", isDeepStrictEqual(ex.l, json("loan-products.json")));
ok("income-thresholds.json 과 같다", isDeepStrictEqual(ex.t, json("income-thresholds.json")));
ok("income-brackets.json 과 같다", isDeepStrictEqual(ex.b, json("income-brackets.json")));
await as("anon");
await expectError("anon 은 export 함수를 못 부른다", () => q("select export_policies()"), /permission denied/);

// ── 팀원 준비 ──
await as("postgres");
await db.exec(`insert into auth.users values ('${UID.A}'),('${UID.B}'),('${UID.C}'),('${UID.U}'),('${UID.V}');
  insert into team_members (user_id, display_name, role) values ('${UID.A}','에이','admin'),('${UID.B}','비','member');`);

// ── 2. 제약 — 에러에 한글 제약 이름이 나온다 ──
console.log("\n[2] 틀린 값은 저장 단계에서 거부");
await db.query("select set_config('perky.import_mode','on',false)");
const vals = (o = {}) => {
  const v = { id: "'test-policy'", name: "'테스트'", agency: "'기관'", region_scope: "'전국'", application_start: "'2026-01-01'",
    benefit_type: "'rent_capped_monthly'", benefit_summary: "'요약'", monthly_cap: "100000",
    required_inputs: "'{birthDate}'", source_url: "'https://a.kr'", apply_url: "'https://a.kr'",
    effective_year: "2026", discovery_regions: "array['전국']", edit_note: "'test'", ...o };
  const cols = Object.keys(v);
  return `insert into data_policies (${cols.join(",")}) values (${cols.map((c) => v[c]).join(",")})`;
};
await q(vals()); await q("delete from data_policies where id = 'test-policy'");
ok("올바른 정책은 들어간다", true);
await expectError("나이 하한 > 상한", () => q(vals({ discovery_age_min: "40", discovery_age_max: "30" })), /"나이_범위"/);
await expectError("모르는 requiredInputs 키", () => q(vals({ required_inputs: "'{birthDay}'" })), /opt_eligibility_input/);
await expectError("requiredInputs 빈 목록", () => q(vals({ required_inputs: "'{}'" })), /"필요_입력_필수"/);
await expectError("지원 형태 오타", () => q(vals({ benefit_type: "'rent_caped_monthly'" })), /opt_benefit_type/);
await expectError("게시 상태 오타", () => q(vals({ status: "'publish'" })), /opt_publish_status/);
await expectError("lump_sum 인데 lumpSumBasis 없음", () => q(vals({ benefit_type: "'lump_sum'", monthly_cap: "null", lump_sum_cap: "500000" })), /"지원_형태별_금액칸"/);
await expectError("월 지원형에 lump_sum_cap", () => q(vals({ lump_sum_cap: "1" })), /"지원_형태별_금액칸"/);
await expectError("youthPolicyNo 19자리", () => q(vals({ youth_policy_no: "'1234567890123456789'" })), /"온통청년_번호_형식"/);
await expectError("youthPolicyNo 중복", () => q(vals({ youth_policy_no: "'20260319005400112218'" })), /"온통청년_번호_중복"/);
await expectError("소득 하한만 있고 상한 없음", () => q(vals({ discovery_income_bracket_min: "3" })), /"소득_하한은_상한과_함께"/);
await expectError("없는 소득 구간 6", () => q(vals({ discovery_income_bracket_max: "6" })), /"소득_상한_구간"/);
await expectError("주거 형태 '반전세'", () => q(vals({ discovery_housing_types: "'{반전세}'" })), /opt_housing_type/);
await expectError("주거 형태 빈 목록", () => q(vals({ discovery_housing_types: "'{}'" })), /"주거형태_빈목록_금지"/);
await expectError("상태 빈 목록", () => q(vals({ discovery_statuses: "'{}'" })), /"상태_빈목록_금지"/);
await expectError("종료일 < 시작일", () => q(vals({ application_end: "'2025-12-31'" })), /"신청_종료는_시작_이후"/);
await expectError("id 대문자", () => q(vals({ id: "'Test'" })), /"id_형식"/);
await expectError("exclusive_group 형식", () => q(vals({ exclusive_group: "array['Rent Group']" })), /"중복_그룹_형식"/);
await expectError("출처 URL 이 http 아님", () => q(vals({ source_url: "'www.a.kr'" })), /"URL_형식"/);
await expectError("중위소득이 가구원 수에 따라 줄어듦", () =>
  q(`insert into data_income_thresholds (effective_year, source_url, source_label, monthly_median_income, edit_note)
     values (2027, 'https://a.kr', 'x', array[300, 200], 'test')`), /"금액_배열"/);
await db.query("select set_config('perky.import_mode','off',false)");

// ── 3. 접근 권한 ──
console.log("\n[3] RLS — 팀원만 읽고 쓴다");
await as("anon");
await expectError("anon 은 정책을 못 읽는다", () => q("select * from data_policies"), /permission denied/);
await as("C");
ok("팀원 아닌 로그인 사용자는 0건", (await q("select count(*)::int n from data_policies"))[0].n === 0);
await expectError("팀원 아닌 사용자는 정책 추가 불가", () => q(vals({ id: "'c-policy'" })), /row-level security|팀원 명단/);
await as("B");
ok("팀원은 6건을 본다", (await q("select count(*)::int n from data_policies"))[0].n === 6);
await expectError("팀원은 삭제 불가 (archived 로)", () => q("delete from data_policies where id = 'iksan-youth-rent-support'"), /permission denied/);
await expectError("member 는 팀원 추가 불가", () => q(`insert into team_members (user_id, display_name) values ('${UID.C}', '씨')`), /row-level security/);

// ── 4. 버전·이력 ──
console.log("\n[4] 내용을 고치면 버전이 오르고 이력이 남는다");
await as("A");
await expectError("고친 이유 없이 수정 불가", () => q("update data_policies set monthly_cap = 210000 where id = 'iksan-youth-rent-support'"), /edit_note/);
await q("update data_policies set monthly_cap = 210000, edit_note = '테스트 수정' where id = 'iksan-youth-rent-support'");
let [row] = await q("select version, edited_by from data_policies where id = 'iksan-youth-rent-support'");
ok("version 1 → 2", row.version === 2);
ok("edited_by = 고친 사람(A)", row.edited_by === UID.A);
const [log] = await q(`select action, changed_by, edit_note, (old_row->>'monthly_cap')::int o, (new_row->>'monthly_cap')::int n
                       from team_change_log where item_key = 'iksan-youth-rent-support' order by id desc limit 1`);
ok("변경 이력에 전·후 값과 이유가 남는다", log.action === "update" && log.changed_by === UID.A && log.o === 200000 && log.n === 210000 && log.edit_note === "테스트 수정");
await q("update data_policies set sort_order = 5 where id = 'iksan-youth-rent-support'");
[row] = await q("select version from data_policies where id = 'iksan-youth-rent-support'");
ok("순서만 바꾸면 버전 그대로", row.version === 2);
await expectError("키(id) 변경 불가", () => q("update data_policies set id = 'iksan-2', edit_note='x' where id = 'iksan-youth-rent-support'"), /키/);
await as("service");
let exp = (await q("select export_policies() p"))[0].p.find((p) => p.id === "iksan-youth-rent-support");
ok("고친 뒤 verifiedAt 은 null (재검수 필요)", exp.verifiedAt === null);

// ── 5. 작성자 ≠ 검수자 ──
console.log("\n[5] 검수");
await as("A");
await expectError("고친 사람(A)은 검수 불가", () => q("insert into team_reviews (policy_id, result) values ('iksan-youth-rent-support','confirmed')"), /작성자/);
await as("B");
await expectError("옛 버전(1판) 검수 불가", () => q("insert into team_reviews (policy_id, target_version, result) values ('iksan-youth-rent-support',1,'confirmed')"), /바뀌었습니다/);
await expectError("팀원이 이관 기록 위조 불가", () => q("insert into team_reviews (policy_id, result, imported) values ('iksan-youth-rent-support','confirmed',true)"), /row-level security/);
await expectError("대상 둘을 동시에 지정 불가", () => q("insert into team_reviews (policy_id, loan_product_id, result) values ('iksan-youth-rent-support','youth-btm-jeonse-loan','confirmed')"), /"대상은_하나만"/);
const [v] = await q("insert into team_reviews (policy_id, result, reviewed_at) values ('iksan-youth-rent-support','confirmed','2020-01-01') returning target_version, reviewed_by, reviewed_at, source_url");
ok("다른 팀원(B)은 검수 가능, 버전·검수자 자동 기록", v.target_version === 2 && v.reviewed_by === UID.B);
ok("검수 시각은 사람이 못 고친다 (지금으로 기록)", new Date(v.reviewed_at).getFullYear() !== 2020);
ok("대조 URL 비우면 정책 출처로 채움", v.source_url.startsWith("https://www.bokjiro.go.kr"));
await as("service");
exp = (await q("select export_policies() p"))[0].p.find((p) => p.id === "iksan-youth-rent-support");
ok("검수 후 verifiedAt 이 다시 나간다", typeof exp.verifiedAt === "string" && exp.verifiedAt.length === 10);
await as("B");
await q("insert into team_reviews (policy_id, result, memo) values ('iksan-youth-rent-support','needs_fix','월 상한이 공고와 다름')");
await as("service");
exp = (await q("select export_policies() p"))[0].p.find((p) => p.id === "iksan-youth-rent-support");
ok("마지막 검수가 needs_fix 면 verifiedAt = null", exp.verifiedAt === null);
await as("B");
const rq = await q("select item_key, needs_review from team_review_queue where kind = '정책'");
ok("검수 대기 목록에서 수정본이 needs_review", rq.find((r) => r.item_key === "iksan-youth-rent-support")?.needs_review === true);
ok("검수 대기 목록에서 이관본은 검수 완료", rq.filter((r) => r.item_key !== "iksan-youth-rent-support").every((r) => r.needs_review === false));

// ── 6. 기록은 못 고친다 ──
console.log("\n[6] 이력·검수 기록 불변");
await as("postgres");
await expectError("변경 이력 수정 불가 (관리자도)", () => q("update team_change_log set edit_note = 'x'"), /고치거나 지울 수 없/);
await expectError("검수 기록 삭제 불가 (관리자도)", () => q("delete from team_reviews"), /고치거나 지울 수 없/);
await expectError("Studio 에서 작성자 없이 수정 불가", () => q("update data_policies set notes = 'x', edit_note = 'studio', edited_by = null where id = 'moland-youth-rent-support'"), /누가 고쳤는지/);

// ── 7. 이용 통계 ──
console.log("\n[7] 이용 통계");
await as("anon");
await q("insert into stats_events (event_name, page_path, session_id) values ('page_view','/find', gen_random_uuid())");
await q("insert into stats_events (event_name, policy_id) values ('apply_click','moland-youth-rent-support')");
ok("anon 이 이벤트를 남긴다", true);
await expectError("모르는 이벤트 이름", () => q("insert into stats_events (event_name, page_path) values ('click','/find')"), /opt_event_name/);
await expectError("경로에 쿼리스트링 불가", () => q("insert into stats_events (event_name, page_path) values ('page_view','/find?age=24')"), /"경로_형식"/);
await expectError("apply_click 에 policy_id 필수", () => q("insert into stats_events (event_name) values ('apply_click')"), /"정책_이벤트는_정책_필수"/);
await expectError("없는 정책 id", () => q("insert into stats_events (event_name, policy_id) values ('policy_open','nope')"), /"대상_정책"/);
await expectError("anon 은 이벤트를 못 읽는다", () => q("select * from stats_events"), /permission denied/);
await as("C");
ok("팀원 아니면 0건", (await q("select count(*)::int n from stats_events"))[0].n === 0);
await as("B");
const daily = await q("select event_name, events::int from stats_daily order by event_name");
ok("팀원은 일별 집계를 본다", daily.length === 2 && daily.every((d) => d.events === 1));

// ── 8. 사용자 저장 ──
console.log("\n[8] 사용자 계정·저장");
await as("U");
await expectError("동의 없이 저장 불가", () => q(`insert into user_answers (user_id, answers) values ('${UID.U}', '{"region":"그 외 지역"}')`), /row-level security/);
await expectError("남의 동의를 대신 못 남김", () => q(`insert into user_consents (user_id, consent_version) values ('${UID.V}','v1')`), /row-level security/);
await q(`insert into user_consents (user_id, consent_version) values ('${UID.U}','2026-11-v1')`);
await q(`insert into user_answers (user_id, answers) values ('${UID.U}', '{"region":"그 외 지역","incomeBracket":2}')`);
await q(`insert into user_calculations (user_id, listing, profile, max_support_amount, final_housing_cost)
         values ('${UID.U}', '{"deposit":3000000}', '{"birthDate":"2000-01-01"}', 2400000, 3000000)`);
ok("동의 후 저장 가능", (await q("select count(*)::int n from user_calculations"))[0].n === 1);
await expectError("너무 큰 답변 거부", () => q(`update user_answers set answers = jsonb_build_object('x', repeat('가', 5000)) where user_id = '${UID.U}'`), /"답변_형식"/);
await as("V");
ok("다른 사용자는 못 본다", (await q("select count(*)::int n from user_answers"))[0].n === 0);
await as("B");
ok("팀원도 사용자 데이터를 못 본다", (await q("select count(*)::int n from user_calculations"))[0].n === 0);
await as("U");
await q(`update user_consents set withdrawn_at = now() where user_id = '${UID.U}'`);
await as("postgres");
const [left] = await q(`select (select count(*) from user_answers where user_id='${UID.U}')::int a,
                               (select count(*) from user_calculations where user_id='${UID.U}')::int c`);
ok("동의 철회 시 저장 데이터 즉시 삭제", left.a === 0 && left.c === 0);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
