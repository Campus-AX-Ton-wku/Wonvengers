// supabase/tests/app-rebuild.test.mjs
// 정책 데이터가 바뀌면 Vercel 다시 빌드 (migrations/20261117110000_app_rebuild.sql)
//
//   cd supabase/tests && node app-rebuild.test.mjs
//
// PGlite 에는 pg_cron · pg_net · Vault 가 없어서 같은 이름의 흉내를 먼저 만든다:
//   net.http_post → net.calls 에 적고 요청 번호를 돌려준다, net._http_response → 손으로 응답을 넣는다,
//   vault.decrypted_secrets → 표, cron.schedule → cron.jobs 에 적는다.
// 마이그레이션의 `create extension` 줄은 PGlite 가 모르는 확장이라 빼고 넣는다.
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

  create schema net;
  create table net.calls (id bigserial primary key, url text, body jsonb);
  create table net._http_response (id bigint primary key, status_code int, timed_out boolean, error_msg text);
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                                headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
    returns bigint language sql as $$ insert into net.calls (url, body) values (url, body) returning id $$;

  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text);

  create schema cron;
  create table cron.jobs (jobname text primary key, schedule text, command text);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
    insert into cron.jobs values (job_name, schedule, command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
    returning 1::bigint $$;
`);
for (const f of ["20261110000000_perky_5tables.sql"]) await db.exec(migration(f));
await db.exec(readFileSync(join(repo, "supabase", "seed.sql"), "utf8"));
for (const f of ["20261115172640_app_policies.sql", "20261115233614_app_fields.sql", "20261116233659_documents.sql"]) {
  await db.exec(migration(f));
}
const rebuildSql = migration("20261117110000_app_rebuild.sql")
  .split("\n")
  .filter((line) => !/^\s*create extension/i.test(line))
  .join("\n");
await db.exec(rebuildSql);

const HOOK = "https://api.vercel.com/v1/integrations/deploy/prj_test/hook";
const run = async () => (await q("select private.request_app_rebuild() as r"))[0].r;
const calls = async () => (await q("select count(*)::int n from net.calls"))[0].n;
const lastRequest = async () => (await q("select last_request_id from private.app_rebuild_state"))[0].last_request_id;
let n = 0;
const edit = (sqlSet, policy = "moland-youth-rent-support") =>
  db.exec(`update policies set ${sqlSet}, edit_note = '검사: 다시 빌드 ${++n}' where policy_no = '${policy}' and is_current`);

console.log("\n[1] 5분마다 도는 예약");
const jobs = await q("select * from cron.jobs");
ok("예약이 하나 있다", jobs.length === 1, JSON.stringify(jobs));
ok("5분마다", jobs[0]?.schedule === "*/5 * * * *");
ok("다시 빌드 함수를 부른다", /private\.request_app_rebuild\(\)/.test(jobs[0]?.command ?? ""));

console.log("\n[2] Deploy Hook 주소");
ok("Vault 에 없으면 부르지 않는다", (await run()) === "Deploy Hook 주소 없음" && (await calls()) === 0);
await db.exec(`insert into vault.decrypted_secrets values ('vercel_deploy_hook', 'abcdefghijklmnopqr')`);
ok("주소 모양이 아니면 부르지 않는다", (await run()) === "Deploy Hook 주소 없음" && (await calls()) === 0);
await db.exec(`update vault.decrypted_secrets set decrypted_secret = '${HOOK}' where name = 'vercel_deploy_hook'`);

console.log("\n[3] 공개 데이터가 바뀔 때만 부른다");
ok("처음에는 부른다", (await run()) === "빌드 요청" && (await calls()) === 1);
ok("Vault 의 주소로 부른다", (await q("select url from net.calls order by id desc limit 1"))[0].url === HOOK);
ok("그대로면 부르지 않는다", (await run()) === "같음" && (await calls()) === 1);
await edit("payout_note = coalesce(payout_note, '') || ' (검사)'");
ok("앱에 나가는 칸을 고치면 부른다", (await run()) === "빌드 요청" && (await calls()) === 2);
ok("한 번만 부른다", (await run()) === "같음" && (await calls()) === 2);
await db.exec(`update policies set edit_note = '검사: 고친 이유만 ${++n}' where policy_no = 'moland-youth-rent-support' and is_current`);
ok("고친 이유만 바꾸면 부르지 않는다", (await run()) === "같음" && (await calls()) === 2);
// 공개 중인 정책 하나(위에서 쓴 것 말고)를 '보류'로 내린다
const other = (await q(`select policy_no from policies where is_current and status in ('예정', '운영') and policy_no <> 'moland-youth-rent-support' order by policy_no limit 1`))[0].policy_no;
await db.exec(`update policies set status = '보류', edit_note = '검사: 보류 ${++n}' where policy_no = '${other}' and is_current`);
ok("정책을 '보류'로 내리면 부른다(앱에서 빠진다)", (await run()) === "빌드 요청" && (await calls()) === 3);
await edit("payout_note = coalesce(payout_note, '') || ' (검사)'", other);
ok("'보류' 정책을 고치면 부르지 않는다", (await run()) === "같음" && (await calls()) === 3);

console.log("\n[4] 실패하면 다음 실행에서 다시 부른다");
await db.exec(`insert into net._http_response values (${await lastRequest()}, 500, false, null)`);
ok("500 이면 다시 부른다", (await run()) === "빌드 요청" && (await calls()) === 4);
await db.exec(`insert into net._http_response values (${await lastRequest()}, null, true, 'timeout')`);
ok("시간 초과여도 다시 부른다", (await run()) === "빌드 요청" && (await calls()) === 5);
await db.exec(`insert into net._http_response values (${await lastRequest()}, 201, false, null)`);
ok("성공하면 더 부르지 않는다", (await run()) === "같음" && (await calls()) === 5);
ok("마지막 상태를 남긴다", (await q("select last_status from private.app_rebuild_state"))[0].last_status === 201);

console.log("\n[5] 밖에서는 못 건드린다");
await db.exec("set role anon");
ok("anon 은 함수를 못 부른다", ((await tryExec("select private.request_app_rebuild()")) ?? "").includes("permission denied"));
ok("anon 은 상태 표를 못 읽는다", ((await tryExec("select * from private.app_rebuild_state")) ?? "").includes("permission denied"));
await db.exec("reset role");

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
