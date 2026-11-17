// supabase/tests/documents.test.mjs
// 정책 서류 목록 documents (migrations/20261116233659_documents.sql) — 모양 검사와 app_policies() 싣기
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
const q = async (sql) => (await db.query(sql)).rows;
const tryExec = async (sql) => { try { await db.exec(sql); return null; } catch (e) { return e.message; } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
for (const f of ["20261110000000_perky_5tables.sql"]) await db.exec(migration(f));
await db.exec(readFileSync(join(repo, "supabase", "seed.sql"), "utf8"));
for (const f of ["20261115172640_app_policies.sql", "20261115233614_app_fields.sql", "20261116233659_documents.sql"]) {
  await db.exec(migration(f));
}

let n = 0; // 트리거가 직전과 같은 edit_note 를 거부하므로 매번 다르게
const set = (json) => `update policies set documents = '${json}'::jsonb, edit_note = '검사: 서류 ${++n}' where policy_no = 'moland-youth-rent-support'`;

console.log("\n[1] 모양 검사");
ok("비워 둘 수 있다", (await q(`select count(*)::int n from policies where documents is null`))[0].n > 0);
ok("이름만", (await tryExec(set('[{"name":"임대차계약서 사본"}]'))) === null);
ok("이름 + 메모", (await tryExec(set('[{"name":"주민등록등본","note":"최근 1개월 이내 발급"}]'))) === null);
ok("정확히 15개", (await tryExec(set(JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ name: `서류${i}` })))))) === null);
ok("메모 80자", (await tryExec(set(`[{"name":"a","note":"${"가".repeat(80)}"}]`))) === null);
for (const [label, json] of [
  ["빈 배열", "[]"],
  ["배열이 아님", '{"name":"a"}'],
  ["이름 없음", '[{"note":"x"}]'],
  ["이름 빈 글자", '[{"name":""}]'],
  ["이름 61자", `[{"name":"${"가".repeat(61)}"}]`],
  ["메모 81자", `[{"name":"a","note":"${"가".repeat(81)}"}]`],
  ["모르는 키", '[{"name":"a","url":"x"}]'],
  ["이름 중복", '[{"name":"a"},{"name":"a"}]'],
  ["16개", JSON.stringify(Array.from({ length: 16 }, (_, i) => ({ name: `서류${i}` })))],
  ["원소가 객체 아님", '["a"]'],
  ["스칼라 null", "null"],
  ["숫자", "3"],
  ["이름이 공백뿐", '[{"name":"   "}]'],
]) {
  ok(`거부: ${label}`, ((await tryExec(set(json))) ?? "").includes("서류_형식"));
}

console.log("\n[2] 공개 함수에 실린다");
await db.exec(set('[{"name":"임대차계약서 사본","note":"확정일자 포함"}]'));
await db.exec("set role anon");
const rows = (await q("select public.app_policies() as v"))[0].v;
await db.exec("reset role");
const moland = rows.find((r) => r.policy_no === "moland-youth-rent-support");
ok("documents 가 나온다", JSON.stringify(moland.documents) === '[{"name":"임대차계약서 사본","note":"확정일자 포함"}]');
ok("없는 정책은 null", rows.some((r) => r.documents === null));

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
