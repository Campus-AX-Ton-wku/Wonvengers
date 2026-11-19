// supabase/tests/policy-icon.test.mjs
// 정책 종류 아이콘 icon (migrations/20261119150917_policy_icon.sql) — 고를 수 있는 이름 · 관리칸 · 지금 정책 채우기 · 공개 함수
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = (f) => readFileSync(join(repo, "supabase", "migrations", f), "utf8");
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name, extra); }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const tryExec = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return e.message; } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(migration("20261110000000_perky_5tables.sql"));
await db.exec(readFileSync(join(repo, "supabase", "seed.sql"), "utf8"));
for (const f of ["20261115172640_app_policies.sql", "20261115233614_app_fields.sql", "20261116233659_documents.sql"]) {
  await db.exec(migration(f));
}

// 아이콘을 넣기 전에 한 정책을 '검수'로 만들어 둔다 — 아이콘을 바꿔도 검수가 남는지 본다
const pid = (await q(`select id from policies where policy_no = 'iksan-youth-rent-support'`))[0].id;
await q(`insert into policy_checks (policy_id, method, result, checked_by, memo) values ($1, '원문대조', '일치', '검사 팀원', '아이콘 검사')`, [pid]);
const before = (await q(`select version, trust_level, edit_note from policies where id = $1`, [pid]))[0];

await db.exec(migration("20261119150917_policy_icon.sql"));

console.log("\n[1] 지금 정책 채우기");
const icons = Object.fromEntries((await q(`select policy_no, icon::text from policies`)).map((r) => [r.policy_no, r.icon]));
for (const [no, icon] of [
  ["moland-youth-rent-support", "rent"],
  ["iksan-youth-rent-support", "rent"],
  ["iksan-newcomer-moving-cost-support", "moving"],
  ["iksan-move-in-household-incentive", "move-in"],
  ["iksan-move-in-student-support", "student"],
  ["youth-housing-benefit-split-payment", "housing-benefit"],
  ["jeonse-return-guarantee-fee-subsidy", "guarantee"],
  ["jeonbuk-youth-settlement-support", "settle"],
  ["youth-dream-savings-account", "bankbook"],
]) ok(`${no} → ${icon}`, icons[no] === icon, icons[no]);
const loans = await q(`select policy_no, icon::text from policies where kind = '대출'`);
ok(`대출 ${loans.length}건 모두 loan`, loans.length > 0 && loans.every((r) => r.icon === "loan"));
ok("임대(연합생활관)는 비워 둔다 — 앱에 나오지 않는다", icons["kosaf-goyang-dormitory"] === null);

console.log("\n[2] 관리칸 — 바꿔도 고친 이유 · 버전 · 검수가 그대로");
const after = (await q(`select version, trust_level from policies where id = $1`, [pid]))[0];
ok("채우기가 버전을 올리지 않았다", after.version === before.version, `${before.version} → ${after.version}`);
ok("채우기 뒤에도 '검수'", before.trust_level === "검수" && after.trust_level === "검수", `${before.trust_level} → ${after.trust_level}`);
const changeErr = await tryExec(`update policies set icon = 'guarantee' where id = ${pid}`);
const changed = (await q(`select icon::text, version, trust_level from policies where id = $1`, [pid]))[0];
ok("고친 이유 없이 바꿀 수 있다", changeErr === null, changeErr ?? "");
ok("바꾼 뒤에도 버전 · 검수 그대로", changed.icon === "guarantee" && changed.version === before.version && changed.trust_level === "검수");
ok("내용 칸은 여전히 고친 이유가 필요하다",
  ((await tryExec(`update policies set summary = summary || '.' where id = ${pid}`)) ?? "").includes("고친_이유_필수"));
await db.exec(`update policies set icon = 'rent' where id = ${pid}`);

console.log("\n[3] 고를 수 있는 이름");
for (const bad of ["calculator", "Rent", "", "form"]) {
  ok(`거부: '${bad}'`, (await tryExec(`update policies set icon = '${bad}' where id = ${pid}`)) !== null);
}
const values = (await q(`select unnest(enum_range(null::public.policy_icon))::text as v`)).map((r) => r.v);
ok("이름 9개", values.join() === "rent,moving,move-in,housing-benefit,guarantee,student,settle,loan,bankbook", values.join());

console.log("\n[4] 공개 함수에 실린다");
await db.exec("set role anon");
const rows = (await q("select public.app_policies() as v"))[0].v;
await db.exec("reset role");
// 11/12 seed 에는 연합생활관(임대)이 아직 공개 상태다 — 실제 DB 에서는 11/15 에 '보류'로 내렸고, 앱도 임대는 싣지 않는다
const shown = rows.filter((r) => r.kind !== "임대");
ok("공개 정책(임대 말고)마다 icon 이 글자로 나온다", shown.length > 0 && shown.every((r) => typeof r.icon === "string"),
  shown.filter((r) => typeof r.icon !== "string").map((r) => r.policy_no).join());
ok("비어 있으면 null 로 나온다(앱 빌드가 이걸 보고 멈춘다)", rows.find((r) => r.policy_no === "kosaf-goyang-dormitory")?.icon === null);
ok("documents 도 그대로 나온다(앞 판의 칸을 잃지 않았다)", rows.every((r) => "documents" in r && "contact_url" in r && "checks" in r));

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
