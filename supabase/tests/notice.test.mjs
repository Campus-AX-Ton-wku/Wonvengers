import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// supabase/raw/notice-<날짜>.sql (공고문 원문 → policy_raw) 을 Supabase 에 넣기 전에 PGlite 에서 먼저 넣어 본다.
//   seed.sql → raw/2026-11-12.sql (API 원문) 을 넣은 뒤(= 지금 Supabase 원문 표 상태)에 이어서 넣는다.
//
//   cd supabase/tests && node notice.test.mjs            # 기본 2026-11-14

const DAY = process.argv[2] ?? "2026-11-14";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p) => readFileSync(join(repo, ...p), "utf8");
const sql = read("supabase", "raw", `notice-${DAY}.sql`);
const files = readdirSync(join(repo, "supabase", "raw", `notice-${DAY}`)).filter((f) => f.endsWith(".json"));
const recs = files.map((f) => JSON.parse(read("supabase", "raw", `notice-${DAY}`, f)));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra); }
};
async function fresh() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;`);
  await db.exec(read("supabase", "migrations", "20261110000000_perky_5tables.sql"));
  await db.exec(read("supabase", "seed.sql"));
  await db.exec(read("supabase", "raw", "2026-11-12.sql"));
  return db;
}
const n = async (db, q) => Number((await db.query(q)).rows[0].n);

console.log(`\n[0] notice-${DAY}.sql 이 최신인가`);
let up = true;
try { execFileSync(process.execPath, [join(repo, "supabase", "raw", "build-notice-sql.mjs"), DAY, "--check"], { stdio: "pipe" }); }
catch { up = false; }
ok("SQL = JSON 으로 다시 만든 결과", up);
ok("JSON 마다 본문 글자가 있다 (1,000자 이상)", recs.every((r) => r.text.length >= 1000), recs.map((r) => `${r.policyId}:${r.text.length}`).join(" "));
ok("archivePath 는 영문·숫자 Storage 키", recs.every((r) => /^source-files\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r.archivePath)));

console.log("\n[1] API 원문 다음에 넣기");
const db = await fresh();
const before = await n(db, `select count(*)::int n from policy_raw`);
const polBefore = (await db.query(`select id, version, trust_level::text, raw_id from policies order by id`)).rows;
let err = null;
try { await db.exec(sql); } catch (e) { err = e.message; }
ok("에러 없이 들어간다", err === null, err ?? "");
ok(`원문 ${files.length}행 늘어남 (${before} → ${before + files.length})`, await n(db, `select count(*)::int n from policy_raw`) === before + files.length);
ok("모두 '공고문' · 외부 번호 없음 · Storage 위치 있음",
  await n(db, `select count(*)::int n from policy_raw where kind = '공고문' and external_id is null and archive_path like 'source-files/%'`) === files.length);
ok("payload.policyId 로 정책 행과 이어진다",
  await n(db, `select count(*)::int n from policy_raw r join policies p on p.policy_no = r.payload->>'policyId' where r.kind = '공고문'`) === files.length);
ok("본문이 JSON 그대로 들어갔다",
  await n(db, `select count(*)::int n from policy_raw where kind = '공고문' and length(payload->>'text') >= 1000`) === files.length);
const polAfter = (await db.query(`select id, version, trust_level::text, raw_id from policies order by id`)).rows;
ok("정책 표는 그대로 (버전 · 신뢰도 · raw_id)", JSON.stringify(polAfter) === JSON.stringify(polBefore));

console.log("\n[2] 두 번 넣으면 멈추고 아무것도 안 바뀐다");
const mid = await n(db, `select count(*)::int n from policy_raw`);
let again = null;
try { await db.exec(sql); } catch (e) { again = e.message; }
try { await db.exec("rollback"); } catch { /* */ }
ok("'이미_넣은_원문'으로 멈춘다", /이미_넣은_원문/.test(again ?? ""), again ?? "(성공해 버림)");
ok("행 개수 그대로", await n(db, `select count(*)::int n from policy_raw`) === mid);

console.log("\n[3] 중간에 틀리면 전부 취소된다");
const db2 = await fresh();
const last = sql.lastIndexOf("insert into public.policy_raw");
const broken = sql.slice(0, last) + sql.slice(last).replace("'공고문'", "'없는종류'");
let bErr = null;
try { await db2.exec(broken); } catch (e) { bErr = e.message; }
try { await db2.exec("rollback"); } catch { /* */ }
ok("마지막 1건이 틀리면 에러", /invalid input value for enum/.test(bErr ?? ""), bErr ?? "(성공해 버림)");
ok("앞의 원문도 남지 않는다", await n(db2, `select count(*)::int n from policy_raw`) === before);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
