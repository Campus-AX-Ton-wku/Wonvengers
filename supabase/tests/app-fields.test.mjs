// supabase/seed/app-fields-2026-11-16.sql — 앱 JSON → DB 이관 (2026-11-16)
//
//   cd supabase/tests && node app-fields.test.mjs
//
// 표 SQL + 11/12 seed + 11/16 마이그레이션 2개 + 이관 SQL 을 PGlite 에 넣고
//   - A(새 칸 채우기)는 버전·신뢰도를 건드리지 않는지
//   - B(전입 지원 2건)는 앱 값 + '운영' + 버전 +1 · 미검수인지
//   - 문의처 이름·주소는 기관 표와 다를 때만 남는지
//   - 이관 SQL 이 보관본(seed/app-data-2026-11-16)으로 만든 결과와 같은지(build-app-fields-sql.mjs --check)
// 를 확인한다. 실제 DB 는 seed 뒤에 팀이 고친 값이 있어 여기 숫자와 다를 수 있다 — 여기서는 규칙만 본다.
import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p) => readFileSync(join(repo, ...p), "utf8");

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra); }
};
const q = async (sql) => (await db.query(sql)).rows;

console.log("\n[0] 이관 SQL 이 최신인가");
let fresh = true;
try { execFileSync(process.execPath, [join(repo, "supabase", "seed", "build-app-fields-sql.mjs"), "--check"], { stdio: "pipe" }); }
catch { fresh = false; }
ok("app-fields-2026-11-16.sql = build-app-fields-sql.mjs 결과", fresh);

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(read("supabase", "migrations", "20261110000000_perky_5tables.sql"));
await db.exec(read("supabase", "seed.sql"));
await db.exec(read("supabase", "migrations", "20261115172640_app_policies.sql"));
await db.exec(read("supabase", "migrations", "20261115233614_app_fields.sql"));
const before = Object.fromEntries((await q(`select policy_no, version, trust_level from policies`)).map((r) => [r.policy_no, r]));

console.log("\n[1] 넣기");
let err = null;
try { await db.exec(read("supabase", "seed", "app-fields-2026-11-16.sql")); } catch (e) { err = e.message; }
ok("에러 없이 들어간다", err === null, err ?? "");
const rows = Object.fromEntries((await q(`select * from policies`)).map((r) => [r.policy_no, r]));

console.log("\n[2] A. 새 칸 채우기 — 버전 그대로");
const A = ["moland-youth-rent-support", "youth-btm-jeonse-loan", "youth-dream-savings-account", "jeonse-return-guarantee-fee-subsidy"];
ok("버전 · 신뢰도가 그대로", A.every((id) => rows[id].version === before[id].version && rows[id].trust_level === before[id].trust_level));
ok("확인일", rows["moland-youth-rent-support"].verified_at?.toISOString?.().slice(0, 10) === "2026-11-03");
ok("외부 번호", rows["moland-youth-rent-support"].youth_policy_no === "20260319005400112218"
  && rows["moland-youth-rent-support"].gov24_service_id === "161300000099");
ok("문의처 이름이 기관 표와 같으면 비운다", rows["moland-youth-rent-support"].contact_label === null);
ok("다르면 남긴다", rows["youth-dream-savings-account"].contact_label === "주택도시보증공사(HUG) 콜센터 — 주택도시기금 포털 문의");
ok("정책별 문의 주소가 돌아온다", rows["youth-dream-didimdol-loan"].contact_url === "https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030901.jsp");
ok("보증료 지원의 지원 형태", rows["jeonse-return-guarantee-fee-subsidy"].benefit_type === "lump_sum"
  && rows["jeonse-return-guarantee-fee-subsidy"].lump_sum_basis === "notCalculable");
ok("perky.sync 는 다시 꺼져 있다", (await q(`select current_setting('perky.sync', true) as v`))[0].v !== "on");

console.log("\n[3] B. 전입 지원 2건");
for (const id of ["iksan-move-in-household-incentive", "iksan-move-in-student-support"]) {
  const r = rows[id];
  ok(`${id}: 운영 · 버전 +1 · 미검수`, r.status === "운영" && r.version === before[id].version + 1 && r.trust_level === "미검수");
  ok(`${id}: 고친 사람 · 이유`, r.edited_by === "ggue" && r.edit_note.includes("재검수 필요"));
  ok(`${id}: 정액 일시금`, r.lump_sum_basis === "fixedGrant" && r.lump_sum_cap > 0 && r.payout_note);
}

console.log("\n[4] 공개 목록");
const pub = (await q(`select public.app_policies() as v`))[0].v;
ok("전입 지원 2건이 공개 목록에 들어온다", pub.some((r) => r.policy_no === "iksan-move-in-student-support"));

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
