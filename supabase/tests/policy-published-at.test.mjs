// supabase/tests/policy-published-at.test.mjs
// 처음 앱에 보인 때 published_at (migrations/20261120054504_policy_published_at.sql) — 자동 찍기 · 관리칸 · 공개 함수
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

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(migration("20261110000000_perky_5tables.sql"));
await db.exec(readFileSync(join(repo, "supabase", "seed.sql"), "utf8"));
for (const f of [
  "20261115172640_app_policies.sql", "20261115233614_app_fields.sql", "20261116233659_documents.sql",
  "20261119150917_policy_icon.sql", "20261120054504_policy_published_at.sql",
]) {
  await db.exec(migration(f));
}

const pid = (await q(`select id from policies where policy_no = 'iksan-youth-rent-support'`))[0].id;
const row = async (id) => (await q(`select published_at, version, trust_level, status::text from policies where id = $1`, [id]))[0];

console.log("\n[1] 지금 정책은 비워 둔다 (알림 기준선)");
const filled = await q(`select policy_no from policies where published_at is not null`);
ok("마이그레이션이 지금 행에 날짜를 찍지 않았다", filled.length === 0, filled.map((r) => r.policy_no).join());

console.log("\n[2] 이미 보이던 정책을 고쳐도 그대로");
await db.exec(`update policies set summary = summary || '.', edit_note = '시험: 요약 고침' where id = ${pid}`);
const edited = await row(pid);
ok("내용을 고쳐도 published_at 은 비어 있다", edited.published_at === null);
ok("내용 고침은 원래대로 버전 +1 · 미검수", edited.version === 2 && edited.trust_level === "미검수", JSON.stringify(edited));

console.log("\n[3] 보이지 않던 행이 보이게 되면 찍힌다");
await db.exec(`update policies set status = '보류' where id = ${pid}`);
ok("보류로 내려도 비어 있다", (await row(pid)).published_at === null);
await db.exec(`update policies set status = '운영' where id = ${pid}`);
const reopened = await row(pid);
ok("보류 → 운영이면 찍힌다", reopened.published_at !== null);
ok("상태 바꾸기는 버전을 올리지 않는다", reopened.version === edited.version, `${edited.version} → ${reopened.version}`);
const firstStamp = reopened.published_at;
await db.exec(`update policies set status = '보류' where id = ${pid}`);
await db.exec(`update policies set status = '운영' where id = ${pid}`);
ok("한 번 찍힌 날은 다시 공개해도 바뀌지 않는다", +(await row(pid)).published_at === +firstStamp);

console.log("\n[4] 보이는 상태로 새로 등록하면 찍힌다");
const [{ id: newId }] = await q(`
  insert into policies overriding system value
  select (jsonb_populate_record(null::policies,
    to_jsonb(p) || jsonb_build_object('id', 90001, 'policy_no', 'test-new-policy', 'published_at', null,
                                      'edit_note', '시험: 새 정책', 'is_current', true, 'status', '운영'))).*
  from policies p where p.id = $1
  returning id`, [pid]);
ok("새 정책은 등록 순간 찍힌다", (await row(newId)).published_at !== null);
const [{ id: hiddenId }] = await q(`
  insert into policies overriding system value
  select (jsonb_populate_record(null::policies,
    to_jsonb(p) || jsonb_build_object('id', 90002, 'policy_no', 'test-hidden-policy', 'published_at', null,
                                      'edit_note', '시험: 보류로 등록', 'is_current', true, 'status', '보류'))).*
  from policies p where p.id = $1
  returning id`, [pid]);
ok("보류로 등록하면 비어 있다", (await row(hiddenId)).published_at === null);

console.log("\n[5] 관리칸 — 손으로 바꿔도 버전 · 검수 그대로");
const before = await row(newId);
await db.exec(`update policies set published_at = '2026-11-21T01:00:00Z' where id = ${newId}`);
const after = await row(newId);
ok("고친 이유 없이 바뀐다", after.published_at.toISOString() === "2026-11-21T01:00:00.000Z", String(after.published_at));
ok("버전 · 검수 그대로", after.version === before.version && after.trust_level === before.trust_level);

console.log("\n[6] 공개 함수에 실린다");
await db.exec("set role anon");
const rows = (await q("select public.app_policies() as v"))[0].v;
await db.exec("reset role");
ok("모든 정책 객체에 published_at 칸이 있다", rows.every((r) => "published_at" in r));
ok("새 정책은 날짜 글자", typeof rows.find((r) => r.policy_no === "test-new-policy")?.published_at === "string");
ok("보류 정책은 공개되지 않는다", !rows.some((r) => r.policy_no === "test-hidden-policy"));
ok("앞 판의 칸(icon · documents · checks)을 잃지 않았다", rows.every((r) => "icon" in r && "documents" in r && "checks" in r));

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
