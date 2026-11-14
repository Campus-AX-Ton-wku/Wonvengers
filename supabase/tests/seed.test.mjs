import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// supabase/seed.sql 을 Supabase 에 넣기 전에 PGlite 에서 먼저 넣어 본다.
//   ① seed.sql 이 지금 JSON·원문으로 만든 것과 같은지
//   ② 에러 없이 들어가고, 14건 값이 앱 JSON 과 같은지
//   ③ 팀원이 바로 원문 대조 '일치'를 남길 수 있는지 (작성자≠검수자에 막히지 않는지)
//   ④ 두 번 넣으면 아무것도 안 바뀌고 멈추는지
//
//   cd supabase/tests && node seed.test.mjs

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// 2026-11-12 seed 를 만들 때 읽은 앱 JSON 보관본 — 지금 앱 데이터가 아니다 (supabase/seed/build-seed.mjs 머리말 참고)
const data = join(repo, "supabase", "seed", "app-data-2026-11-12");
const json = (f) => JSON.parse(readFileSync(join(data, f), "utf8"));
const seedSql = readFileSync(join(repo, "supabase", "seed.sql"), "utf8");

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra); }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const count = async (sql) => (await q(sql))[0].n;

console.log("\n[0] seed.sql 이 최신인가");
let fresh = true;
try { execFileSync(process.execPath, [join(repo, "supabase", "seed", "build-seed.mjs"), "--check"], { stdio: "pipe" }); }
catch { fresh = false; }
ok("seed.sql = build-seed.mjs 결과 (JSON 이 바뀌었으면 다시 만들 것)", fresh);
ok("API 키가 파일에 없다", !/serviceKey/i.test(seedSql));

// ── Supabase 흉내 + 표 만들기 ──
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(readFileSync(join(repo, "supabase", "migrations", "20261110000000_perky_5tables.sql"), "utf8"));

console.log("\n[1] 넣기");
let seedError = null;
try { await db.exec(seedSql); } catch (e) { seedError = e.message; }
ok("에러 없이 들어간다", seedError === null, seedError ?? "");
ok("정책 16건", await count(`select count(*)::int n from policies`) === 16);
ok("새 후보 2건만 '보류'", (await q(`select policy_no from policies where status = '보류' order by 1`))
  .map((r) => r.policy_no).join() === "iksan-move-in-household-incentive,iksan-move-in-student-support");
ok("확인 기록은 0행 (ggue 11/3 은 edit_note 에)", await count(`select count(*)::int n from policy_checks`) === 0);
ok("전부 미검수 · 버전 1 · 확인일 없음",
  await count(`select count(*)::int n from policies where trust_level = '미검수' and version = 1 and checked_at is null`) === 16);
ok("지역 코드는 00 · 52 · 52140 뿐",
  await count(`select count(*)::int n from policies, unnest(region_codes) rc where rc not in ('00', '52', '52140')`) === 0
  && await count(`select count(*)::int n from agencies where region_code not in ('00', '52', '52140')`) === 0);
ok("작성자는 사람 이름이 아니다",
  await count(`select count(*)::int n from policies where edited_by not like 'seed %'`) === 0);
ok("모든 정책에 전화번호 있는 문의 창구",
  await count(`select count(*)::int n from policies p join agencies a on a.id = p.contact_id where a.phone is not null`) === 16);

console.log("\n[2] 14건 값 = 앱 JSON");
const REGION = { "전국": "00", "전북특별자치도": "52", "전북특별자치도 익산시": "52140" };
const inScope = (x) => x.regionScope in REGION;
const fromJson = [...json("policies.json"), ...json("loan-products.json"), ...json("housing-supply.json")].filter(inScope);
const rows = Object.fromEntries((await q(`select p.*, a.phone as contact_phone from policies p
  join agencies a on a.id = p.contact_id`)).map((r) => [r.policy_no, r]));
// PGlite 는 선택지 배열(opt_status[] 등)을 '{대학생,재직}' 글자로 돌려준다 → 배열로 풀어서 비교
const pgArr = (v) => (typeof v === "string" && /^\{.*\}$/.test(v)
  ? (v === "{}" ? [] : v.slice(1, -1).split(",").map((s) => s.replace(/^"(.*)"$/, "$1")))
  : v);
const same = (a, b) => JSON.stringify(pgArr(a) ?? null) === JSON.stringify(b ?? null);
const diffs = [];
for (const x of fromJson) {
  const r = rows[x.id];
  if (!r) { diffs.push(`${x.id}: 없음`); continue; }
  const d = x.discovery ?? {};
  const pairs = {
    name: [r.name, x.name], source_url: [r.source_url, x.sourceUrl], apply_url: [r.apply_url, x.applyUrl],
    summary: [r.summary, x.benefitSummary ?? x.summary], year: [r.year, x.effectiveYear],
    region: [r.region_codes, [REGION[x.regionScope]]], region_label: [r.region_label, x.regionScope],
    apply_start: [r.apply_start?.toISOString?.().slice(0, 10) ?? null, x.applicationStart],
    apply_end: [r.apply_end?.toISOString?.().slice(0, 10) ?? null, x.applicationEnd],
    age_min: [r.age_min, d.ageMin], age_max: [r.age_max, d.ageMax], statuses: [r.statuses, d.statuses],
    income_min: [r.income_bracket_min, d.incomeBracketMin], income_max: [r.income_bracket_max, d.incomeBracketMax],
    housing: [r.housing_types, d.housingTypes], monthly_cap: [r.monthly_cap, x.monthlyCap],
    max_months: [r.max_months, x.maxMonths], lump_sum_cap: [r.lump_sum_cap, x.lumpSumCap],
    required_inputs: [r.required_inputs, x.requiredInputs], exclusive: [r.exclusive_groups, x.exclusiveGroup],
    phone: [r.contact_phone, x.contact.phone],
  };
  for (const [k, [db_, js]] of Object.entries(pairs)) if (!same(db_, js)) diffs.push(`${x.id}.${k}: DB=${JSON.stringify(db_)} JSON=${JSON.stringify(js)}`);
}
ok(`JSON 14건이 모두 들어감 (${fromJson.length}건)`, fromJson.length === 14);
ok("이름·주소·요약·기간·나이·상태·소득·주거·금액·문의 전화가 JSON 과 같다", diffs.length === 0, "\n      " + diffs.join("\n      "));
// 현금 계산 방식은 '보증료'로 바꾼 1건만 비고 나머지는 JSON 그대로
const cashDiff = fromJson.filter((x) => json("policies.json").some((p) => p.id === x.id))
  .filter((x) => !same(rows[x.id].benefit_type, x.id === "jeonse-return-guarantee-fee-subsidy" ? null : x.benefitType));
ok("현금 계산 방식 = JSON (보증료로 분류한 전세보증료 1건만 비움)", cashDiff.length === 0, cashDiff.map((x) => x.id).join());
ok("JSON 메모(notes)를 잃지 않았다",
  fromJson.filter((x) => x.notes).every((x) => rows[x.id].notes.includes(x.notes)));
ok("edit_note 에 ggue 11/3 재대조를 밝혔다",
  await count(`select count(*)::int n from policies where edited_by = 'seed 이관(JSON 원본)' and edit_note like '%ggue%2026-11-03%'`) === 14);

console.log("\n[3] 새 후보 2건 = 보조금24 원문");
const raws = await q(`select external_id, url, payload, retrieved_at from policy_raw order by external_id`);
ok("원문 2행 (보조금24 서비스ID)", raws.map((r) => r.external_id).join() === "468100000001,468100000005");
for (const r of raws) {
  const det = r.payload.serviceDetail.data[0];
  const p = Object.values(rows).find((x) => x.raw_id && x.name === det["서비스명"]);
  ok(`${det["서비스명"]}: 정책 행이 이 원문을 가리킨다`, !!p);
  if (!p) continue;
  ok(`${det["서비스명"]}: 현금(보조금24 지원유형 그대로) · 계산 안 함 · 금액 비움`,
    p.kind === det["지원유형"] && p.benefit_type === "lump_sum" && p.lump_sum_basis === "notCalculable" && p.lump_sum_cap === null);
  ok(`${det["서비스명"]}: 요약은 원문 지원내용 문구 그대로`, det["지원내용"].includes(p.summary));
  ok(`${det["서비스명"]}: 문의 전화 = 원문 문의처`, det["문의처"].endsWith(p.contact_phone));
  ok(`${det["서비스명"]}: 원문 가져온 시각 보존`, r.retrieved_at.toISOString() === r.payload.fetchedAt);
}

console.log("\n[4] 멘토 시연 쿼리");
const TODAY = "2026-11-17";
const m = await q(`select * from match_policies(22, '52140', '대학생', 2, '월세', false, $1)`, [TODAY]);
ok("보류 2건은 결과에 안 나온다 (14건)", m.length === 14);
const byNo = Object.fromEntries(m.map((r) => [r.policy_no, r]));
ok("익산형 청년월세 = 소득만 안 맞음 → 한 번 더 확인",
  byNo["iksan-youth-rent-support"].near_miss && byNo["iksan-youth-rent-support"].fail_fields.join() === "소득");
ok("문의처가 함께 나온다", m.every((r) => r.contact && /\d/.test(r.contact)));

console.log("\n[5] 팀원이 바로 검수할 수 있다");
const pid = (await q(`select id from policies where policy_no = 'iksan-youth-rent-support'`))[0].id;
const check = (who) => q(`insert into policy_checks (policy_id, method, result, checked_by, memo)
  values ($1, '원문대조', '일치', $2, 'seed 검사')`, [pid, who]);
let err = null;
try { await check("노찬영"); } catch (e) { err = e.message; }
ok("노찬영 원문대조 '일치' → 막히지 않는다 → 검수", err === null
  && (await q(`select trust_level from policies where id = $1`, [pid]))[0].trust_level === "검수", err ?? "");
await check("박민준");
ok("박민준까지 → 교차검수", (await q(`select trust_level from policies where id = $1`, [pid]))[0].trust_level === "교차검수");

console.log("\n[6] 두 번 넣으면 멈추고 아무것도 안 바뀐다");
const before = await count(`select (select count(*) from policies) + (select count(*) from agencies) + (select count(*) from policy_raw) + (select count(*) from policy_checks) as n`);
let again = null;
try { await db.exec(seedSql); } catch (e) { again = e.message; }
try { await db.exec("rollback"); } catch { /* 이미 끝난 transaction */ }
ok("두 번째 실행은 '이미_적재됨'으로 멈춘다", /이미_적재됨/.test(again ?? ""), again ?? "(성공해 버림)");
ok("행 개수 그대로", await count(`select (select count(*) from policies) + (select count(*) from agencies) + (select count(*) from policy_raw) + (select count(*) from policy_checks) as n`) === before);

console.log("\n[7] 중간에 틀리면 전부 취소된다");
const db2 = new PGlite();
await db2.exec(`create role anon nologin; create role authenticated nologin;`);
await db2.exec(readFileSync(join(repo, "supabase", "migrations", "20261110000000_perky_5tables.sql"), "utf8"));
const broken = seedSql.replace("'iksan-youth-rent-support', 2026", "'iksan-youth-rent-support', 1999");   // 연도_범위 위반
let brokenErr = null;
try { await db2.exec(broken); } catch (e) { brokenErr = e.message; }
try { await db2.exec("rollback"); } catch { /* */ }
const left = (await db2.query(`select (select count(*) from agencies) + (select count(*) from policy_raw) as n`)).rows[0].n;
ok("정책 1건이 틀리면 에러", /연도_범위/.test(brokenErr ?? ""), brokenErr ?? "(성공해 버림)");
ok("앞에서 넣은 기관·원문도 남지 않는다", Number(left) === 0, `남은 행 ${left}`);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
