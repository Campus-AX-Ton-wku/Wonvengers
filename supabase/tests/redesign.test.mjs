import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 재설계 5테이블 초안(supabase/redesign/)을 PGlite 에 적용해서
//   ① 지금 앱 데이터 중 전국·전북·익산 정책이 들어가는지
//   ② 멘토가 말한 "사용자 조건 → Select" 가 앱과 같은 답을 내는지
//   ③ 원문 보존·작성자≠검수자·정책 확인일 같은 규칙이 지켜지는지
// 를 확인한다.
//
//   cd supabase/tests && node redesign.test.mjs
//   SHOW=1 node redesign.test.mjs   # 거부될 때 에러 문구까지

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
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
  try { await fn(); ok(name, false, "(에러가 나야 하는데 성공함)"); }
  catch (e) {
    const m = String(e.message);
    ok(name, !pattern || pattern.test(m), "→ " + m);
    if (process.env.SHOW) console.log("      ↳", m);
  }
}
async function as(role) {
  await db.exec("reset role");
  if (role !== "postgres") await db.exec(`set role ${role}`);
}

// ── Supabase 흉내 ──
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);

console.log("\n[0] 적용");
await db.exec(readFileSync(join(repo, "supabase", "redesign", "20261110000000_perky_5tables.sql"), "utf8"));
const tables = (await q(`select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)).map((r) => r.table_name);
ok(`표는 5개 (${tables.join(", ")})`, tables.length === 5);
const noComment = await q(`
  select c.table_name || '.' || c.column_name as col
  from information_schema.columns c
  join pg_class t on t.relname = c.table_name and t.relnamespace = 'public'::regnamespace
  where c.table_schema = 'public' and t.relkind = 'r'
    and col_description(t.oid, c.ordinal_position) is null`);
ok("모든 칸에 한글 설명", noComment.length === 0, noComment.map((r) => r.col).join(", "));

// ── 지금 앱 데이터 중 지역 코드를 확실히 아는 것만 넣는다 ──
// 다른 시군구 코드는 행정표준코드 원본에서 받아야 한다 (추정 금지).
const REGION = { "전국": "00", "전북특별자치도": "52", "전북특별자치도 익산시": "52140" };
const PURPOSE = {
  "moland-youth-rent-support": "주거비 경감",
  "iksan-youth-rent-support": "주거비 경감",
  "jeonbuk-youth-settlement-support": "이주·정착",
  "iksan-newcomer-moving-cost-support": "이주·정착",
  "youth-housing-benefit-split-payment": "주거비 경감",
  "jeonse-return-guarantee-fee-subsidy": "보증금 안전",
  "youth-btm-jeonse-loan": "주거비 경감",
  "iksan-youth-home-purchase-loan-interest": "자산 형성",
  "youth-dream-didimdol-loan": "자산 형성",
  "youth-dream-savings-account": "자산 형성",
  "kosaf-goyang-dormitory": "주택 공급",
};
// 위에 없는 새 항목은 지원 형태로 목적을 정한다 (시험용 기본값 — 실제 적재 때는 사람이 원문 보고 정한다)
const PURPOSE_BY_KIND = { "현금": "주거비 경감", "대출": "주거비 경감", "보증료": "보증금 안전", "임대": "주택 공급", "저축": "자산 형성" };
const KIND = { loan_interest_subsidy: "대출", guarantee_fee_subsidy: "보증료", savings_account: "저축" };

console.log("\n[1] 지금 데이터 넣기 (전국·전북·익산만)");
const agencyId = new Map();
async function agency(name) {
  if (agencyId.has(name)) return agencyId.get(name);
  const level = /(공사|재단|기금|HUG)/.test(name) ? "공공기관"
    : /시$|군$|구$/.test(name) ? "시군구"
    : /도$/.test(name) ? "시도" : "중앙부처";
  const region = name === "익산시" ? "52140" : name === "전북특별자치도" ? "52" : "00";
  const [r] = await q(`insert into agencies (name, level, region_code) values ($1, $2, $3) returning id`,
    [name, level, region]);
  agencyId.set(name, r.id);
  return r.id;
}
async function raw(kind, title, url, payload, externalId = null) {
  const [r] = await q(`insert into policy_raw (kind, external_id, title, url, payload, retrieved_by)
    values ($1, $2, $3, $4, $5, '이관 스크립트') returning id`, [kind, externalId, title, url, payload]);
  return r.id;
}
// 선택지 배열(opt_status[] 등)은 PGlite 가 JS 배열을 못 바꿔서 '{"a","b"}' 글자로 넘긴다
const arr = (a) => (a == null ? null : "{" + a.map((s) => `"${String(s).replaceAll('"', '\\"')}"`).join(",") + "}");
const seen = new Set();
async function addPolicy(x, kind) {
  if (seen.has(x.id)) return false;               // 전세보증료처럼 두 파일에 있던 중복은 한 번만
  seen.add(x.id);
  const d = x.discovery ?? {};
  const rawId = await raw("공고문", x.name, x.sourceUrl, { note: "이관 테스트용 — 실제 적재 때는 공고 본문을 넣는다" });
  if (x.youthPolicyNo) await raw("온통청년API", x.name, "https://www.youthcenter.go.kr", {}, x.youthPolicyNo);
  if (x.gov24ServiceId) await raw("보조금24API", x.name, "https://www.gov.kr", {}, x.gov24ServiceId);
  await q(`insert into policies (policy_no, year, raw_id, agency_id, source_url, apply_url, name, kind, purpose,
      summary, apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
      income_bracket_min, income_bracket_max, housing_types, benefit_type, monthly_cap, max_months,
      lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs, notes, edited_by, edit_note)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,
      '이관 스크립트', 'apps/web/data 에서 이관')`,
    [x.id, x.effectiveYear ?? 2026, rawId, await agency(x.agency), x.sourceUrl, x.applyUrl ?? null, x.name, kind,
     PURPOSE[x.id] ?? PURPOSE_BY_KIND[kind], x.benefitSummary ?? x.summary ?? x.name, x.applicationStart ?? null, x.applicationEnd ?? null,
     d.ageMin ?? null, d.ageMax ?? null, arr([REGION[x.regionScope]]), x.regionScope, arr(d.statuses ?? null),
     d.incomeBracketMin ?? null, d.incomeBracketMax ?? null, arr(d.housingTypes ?? null),
     kind === "현금" ? x.benefitType : null, x.monthlyCap ?? null, x.maxMonths ?? null,
     x.lumpSumCap ?? null, x.lumpSumBasis ?? null, arr(x.exclusiveGroup ?? []), arr(x.requiredInputs ?? null), x.notes ?? null]);
  return true;
}
const inScope = (x) => x.regionScope in REGION;
let nP = 0, nL = 0, nH = 0;
for (const x of json("policies.json").filter(inScope)) if (await addPolicy(x, "현금")) nP++;
for (const x of json("loan-products.json").filter(inScope)) if (await addPolicy(x, KIND[x.productType])) nL++;
for (const x of json("housing-supply.json").filter(inScope)) if (await addPolicy(x, "임대")) nH++;
const [{ n }] = await q(`select count(*)::int n from policies`);
ok(`현금 ${nP} · 대출등 ${nL} · 공급 ${nH} = ${n}건 들어감`, n === nP + nL + nH && nP === 6);
ok("전세보증료 중복은 한 행으로", (await q(`select count(*)::int n from policies where policy_no = 'jeonse-return-guarantee-fee-subsidy'`))[0].n === 1);
ok("온통청년·보조금24 번호는 원문 표로", (await q(`select count(*)::int n from policy_raw where external_id is not null`))[0].n > 0);
ok("처음엔 모두 미검수", (await q(`select count(*)::int n from policies where trust_level <> '미검수'`))[0].n === 0);

// ── 멘토 시나리오 ──
const TODAY = "2026-11-09";
const match = (age, region, status, bracket, housing, military = false) =>
  q(`select * from match_policies($1, $2, $3, $4, $5, $6, $7)`, [age, region, status, bracket, housing, military, TODAY]);
const byNo = (rows) => Object.fromEntries(rows.map((r) => [r.policy_no, r]));
const show = (title, rows) => {
  console.log(`\n  ${title}`);
  for (const r of rows.filter((r) => r.kind === "현금"))
    console.log(`    ${r.tag.padEnd(6)} ${r.pass_count}/5 충족  ${r.apply_state.padEnd(3)}  ${r.name}` +
      (r.fail_fields.length ? `  ✗ ${r.fail_fields.join(",")}` : "") +
      (r.unknown_fields.length ? `  ? ${r.unknown_fields.join(",")}` : "") +
      (r.near_miss ? "  ← 한 번 더 확인" : ""));
};

console.log("\n[2] 사용자 조건 → Select");
const seoul = byNo(await match(22, "11110", "대학생", 2, "월세"));
show("멘토 입력: 만 22세 · 서울 종로구(11110) · 대학생 · 월 100~150만 · 월세", Object.values(seoul));
ok("주거급여 분리지급 = 확인 필요 (소득) — 멘토가 본 '판단 보류'와 같다",
  seoul["youth-housing-benefit-split-payment"].tag === "확인 필요"
  && seoul["youth-housing-benefit-split-payment"].unknown_fields.join() === "소득");
ok("국토부 청년월세 = 가능성 있음 · 마감", seoul["moland-youth-rent-support"].tag === "가능성 있음"
  && seoul["moland-youth-rent-support"].apply_state === "마감");
ok("익산 정책은 지역 불일치", seoul["iksan-youth-rent-support"].fail_fields.includes("지역"));
ok("지역만 다른 정책은 '한 번 더 확인'에 안 넣는다", seoul["iksan-newcomer-moving-cost-support"].near_miss === false);

const iksan = byNo(await match(22, "52140", "대학생", 2, "월세"));
show("익산 대학생: 만 22세 · 익산(52140) · 대학생 · 월 100~150만 · 월세", Object.values(iksan));
ok("익산형 청년월세 = 소득만 안 맞음 → 한 번 더 확인", iksan["iksan-youth-rent-support"].near_miss
  && iksan["iksan-youth-rent-support"].fail_fields.join() === "소득");
ok("전북 지역정착 = 상태 불일치 (재직만)", iksan["jeonbuk-youth-settlement-support"].fail_fields.join() === "상태");
ok("전세보증료 = 주거 불일치 (전세만)", iksan["jeonse-return-guarantee-fee-subsidy"].fail_fields.join() === "주거");
// 접수 상태는 데이터의 신청 기간에서 기대값을 계산한다 — 공고를 다시 대조하면 바뀌기 때문이다
const moving = json("policies.json").find((x) => x.id === "iksan-newcomer-moving-cost-support");
const movingState = !moving.applicationEnd ? "상시"
  : TODAY > moving.applicationEnd ? "마감"
  : moving.applicationStart && TODAY < moving.applicationStart ? "예정" : "접수중";
ok(`이사비·중개보수 = 가능성 있음 · ${movingState} (데이터의 신청 기간 그대로)`,
  iksan["iksan-newcomer-moving-cost-support"].tag === "가능성 있음"
  && iksan["iksan-newcomer-moving-cost-support"].apply_state === movingState);
ok("문의처가 함께 나온다", !!iksan["iksan-youth-rent-support"].contact);

const sido = byNo(await match(22, "52", "대학생", 3, "월세"));
ok("시도(전북)까지만 고르면 익산 정책은 지역 확인 필요",
  sido["iksan-youth-rent-support"].unknown_fields.includes("지역"));

console.log("\n[3] 고치면 버전이 오르고, 군 복무 가산이 판정에 들어간다");
await expectError("고친 이유 없이 수정 불가",
  () => q(`update policies set age_military_extension = 2 where policy_no = 'moland-youth-rent-support'`), /고친_이유_필수/);
await q(`update policies set age_military_extension = 2, edited_by = '박민준',
  edit_note = '테스트: 군 복무 가산 2년 (실제 공고 확인 전 값)' where policy_no = 'moland-youth-rent-support'`);
const [m1] = await q(`select version, trust_level from policies where policy_no = 'moland-youth-rent-support'`);
ok("version 1 → 2, 미검수", m1.version === 2 && m1.trust_level === "미검수");
ok("만 36세 군필 → 나이 통과", byNo(await match(36, "52140", "재직", 2, "월세", true))["moland-youth-rent-support"].fail_fields.length === 0);
ok("만 36세 미필 → 나이 불일치", byNo(await match(36, "52140", "재직", 2, "월세", false))["moland-youth-rent-support"].fail_fields.join() === "나이");
await q(`update policies set trust_level = '교차검수', edited_by = '박민준', edit_note = '등급을 손으로 올려 보기'
  where policy_no = 'moland-youth-rent-support'`);
ok("신뢰도 등급은 손으로 못 바꾼다",
  (await q(`select trust_level from policies where policy_no = 'moland-youth-rent-support'`))[0].trust_level === "미검수");

console.log("\n[4] 틀린 값은 저장 단계에서 거부");
const base = `insert into policies (policy_no, year, agency_id, source_url, name, kind, purpose, summary,
  region_codes, region_label, edited_by, edit_note`;
const a1 = agencyId.get("익산시");
await expectError("나이 하한 > 상한", () => q(`${base}, age_min, age_max) values ('t-a', 2026, ${a1}, 'https://x.kr', 't', '대출', '자산 형성', 't', '{52140}', 't', 'a', 'b', 40, 19)`), /나이_범위/);
await expectError("지역 코드 형식", () => q(`${base}) values ('t-b', 2026, ${a1}, 'https://x.kr', 't', '대출', '자산 형성', 't', '{익산}', 't', 'a', 'b')`), /지역코드_형식/);
await expectError("현금인데 지원 형태 없음", () => q(`${base}) values ('t-c', 2026, ${a1}, 'https://x.kr', 't', '현금', '주거비 경감', 't', '{52140}', 't', 'a', 'b')`), /현금_지원형태/);
await expectError("하한만 있는 소득 구간", () => q(`${base}, income_bracket_min) values ('t-d', 2026, ${a1}, 'https://x.kr', 't', '대출', '자산 형성', 't', '{52140}', 't', 'a', 'b', 3)`), /하한만_금지/);
await expectError("원문 주소 없음", () => q(`${base}) values ('t-e', 2026, ${a1}, 'x.kr', 't', '대출', '자산 형성', 't', '{52140}', 't', 'a', 'b')`), /원문주소_형식/);
await expectError("같은 정책의 현재 회차는 하나", () => q(`${base}, round_label) values ('iksan-youth-rent-support', 2027, ${a1}, 'https://x.kr', 't', '대출', '자산 형성', 't', '{52140}', 't', 'a', 'b', '1차')`), /현재_회차는_하나/);
await expectError("없는 선택지 값", () => q(`${base}) values ('t-f', 2026, ${a1}, 'https://x.kr', 't', '상품권', '자산 형성', 't', '{52140}', 't', 'a', 'b')`), /invalid input value for enum/);
await expectError("전화번호 형식", () => q(`insert into agencies (name, level, region_code, department, phone) values ('익산시', '시군구', '52140', '청년일자리과', '8597358')`), /전화번호_형식/);
await expectError("전화 원문에 답 없음", () => q(`insert into policy_raw (kind, title, payload, retrieved_by) values ('전화', '익산시 문의', '{"question":"q"}', '노찬영')`), /전화_답변_필수/);

console.log("\n[5] 원문·기록은 고치거나 지울 수 없다");
await expectError("원문 수정 불가", () => q(`update policy_raw set title = 'x' where id = 1`), /기록_수정_삭제_금지/);
await expectError("원문 삭제 불가", () => q(`delete from policy_raw where id = 1`), /기록_수정_삭제_금지/);
await expectError("정책 삭제 불가", () => q(`delete from policies where policy_no = 'iksan-youth-rent-support'`), /정책_삭제_금지/);
await expectError("같은 원문 두 번 저장 불가", () => q(`insert into policy_raw (kind, title, url, payload, retrieved_by)
  select kind, title, url, payload, retrieved_by from policy_raw where id = 1`), /원문_중복/);

console.log("\n[6] 확인 기록 → 정책 확인일·신뢰도 등급");
const pid = (await q(`select id from policies where policy_no = 'iksan-youth-rent-support'`))[0].id;
const level = async () => (await q(`select trust_level, checked_at, version from policies where id = $1`, [pid]))[0];
const check = (who, method, result, extra = {}) => q(`insert into policy_checks (policy_id, method, result, checked_by, question, answer, memo)
  values ($1, $2, $3, $4, $5, $6, $7)`, [pid, method, result, who, extra.question ?? null, extra.answer ?? null, extra.memo ?? null]);
await expectError("작성자는 자기 버전을 검수할 수 없다", () => check("이관 스크립트", "원문대조", "일치"), /작성자_검수자_같음/);
await check("노찬영", "원문대조", "일치", { memo: "공고 2쪽 표" });
let L1 = await level();
ok("1명 일치 → 검수, 정책 확인일 생김", L1.trust_level === "검수" && L1.checked_at !== null);
await check("박민준", "전화문의", "일치", { question: "모집 인원?", answer: "230명, 선착순 아님" });
ok("서로 다른 2명 일치 → 교차검수", (await level()).trust_level === "교차검수");
await check("nightly-check", "자동확인", "내용변경", { memo: "원문 지문이 바뀜" });
ok("매일 밤 확인에서 원문이 바뀜 → 재확인 필요", (await level()).trust_level === "재확인 필요");
await check("이병규", "원문대조", "일치", { memo: "바뀐 공고 다시 대조 — 날짜 표기만 바뀜" });
ok("사람이 다시 확인 → 교차검수로 돌아옴", (await level()).trust_level === "교차검수");
await expectError("AI 교차는 자동확인 결과를 못 쓴다", () => check("노찬영", "AI교차", "정상"), /결과_종류/);
await expectError("질문중인데 질문 없음", () => check("노찬영", "전화문의", "질문중"), /질문_필수/);
await expectError("확인 기록 삭제 불가", () => q(`delete from policy_checks where policy_id = $1`, [pid]), /기록_수정_삭제_금지/);
await q(`update policies set apply_end = '2027-09-30', edited_by = '노찬영', edit_note = '테스트: 2027년 회차 기간' where id = $1`, [pid]);
const L2 = await level();
ok("내용을 고치면 옛 확인은 무효 → 미검수 (확인일은 남는다)", L2.version === 2 && L2.trust_level === "미검수" && L2.checked_at !== null);

console.log("\n[7] 권한");
await as("anon");
await q(`insert into user_conditions (age, region_code, status, income_bracket, income_basis, housing_type)
  values (22, '52140', '대학생', 2, '세후', '월세')`);
ok("익명 사용자는 조건을 넣을 수 있다", true);
ok("익명 사용자는 남의 조건을 못 본다", (await q(`select * from user_conditions`)).length === 0);
await expectError("익명은 test 경로로 못 넣는다", () => q(`insert into user_conditions (channel) values ('test')`), /row-level security/);
ok("익명도 정책은 읽는다 (공개 정보)", (await q(`select count(*)::int n from policies`))[0].n === n);
ok("익명은 원문 표를 못 본다", (await q(`select * from policy_raw`)).length === 0);
await expectError("익명은 정책을 못 고친다", () => q(`${base}) values ('t-g', 2026, ${a1}, 'https://x.kr', 't', '대출', '자산 형성', 't', '{52140}', 't', 'a', 'b')`), /row-level security/);
await as("authenticated");
ok("팀원은 조건을 본다 = 누적 이용자 수", (await q(`select count(*)::int n from user_conditions where channel = 'web'`))[0].n === 1);
await as("postgres");

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
