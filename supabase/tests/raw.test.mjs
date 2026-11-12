import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// supabase/raw/<날짜>.sql (API 원문 → policy_raw) 을 Supabase 에 넣기 전에 PGlite 에서 먼저 넣어 본다.
//   seed.sql 을 넣은 뒤(= 지금 Supabase 상태)에 이어서 넣는다.
//
//   cd supabase/tests && node raw.test.mjs            # 기본 2026-11-12
//   cd supabase/tests && node raw.test.mjs 2026-11-20

const DAY = process.argv[2] ?? "2026-11-12";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p) => readFileSync(join(repo, ...p), "utf8");
const rawSql = read("supabase", "raw", `${DAY}.sql`);
const files = readdirSync(join(repo, "supabase", "raw", DAY)).filter((f) => f.endsWith(".json"));
const R = { "전국": 1, "전북특별자치도": 1, "전북특별자치도 익산시": 1 };
const json = (f) => JSON.parse(read("apps", "web", "data", f));
const scope = ["policies.json", "loan-products.json", "housing-supply.json"].flatMap(json).filter((x) => x.regionScope in R);

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
  return db;
}
const n = async (db, sql) => Number((await db.query(sql)).rows[0].n);

console.log(`\n[0] ${DAY}.sql 이 최신인가`);
let up = true;
try { execFileSync(process.execPath, [join(repo, "supabase", "raw", "build-raw-sql.mjs"), DAY, "--check"], { stdio: "pipe" }); }
catch { up = false; }
ok("SQL = 원문 파일로 다시 만든 결과", up);
ok("API 키 칸이 SQL 에 없다", !/serviceKey|apiKeyNm/i.test(rawSql));
const wanted = scope.flatMap((x) => [
  ...(x.gov24ServiceId ? [`보조금24API ${x.gov24ServiceId} ${x.id}`] : []),
  ...(x.youthPolicyNo ? [`온통청년API ${x.youthPolicyNo} ${x.id}`] : []),
]).sort();
ok(`14건 중 API 번호가 있는 것 전부 (${wanted.length}개 = 응답 파일 ${files.length}개)`, wanted.length === files.length);

console.log("\n[1] seed 다음에 넣기");
const db = await fresh();
const before = await n(db, `select count(*)::int n from policy_raw`);
let err = null;
try { await db.exec(rawSql); } catch (e) { err = e.message; }
ok("에러 없이 들어간다", err === null, err ?? "");
ok(`원문 ${files.length}행 늘어남 (${before} → ${before + files.length})`, await n(db, `select count(*)::int n from policy_raw`) === before + files.length);
const got = (await db.query(`select kind::text || ' ' || external_id || ' ' || (payload->>'policyId') as k from policy_raw
  where kind in ('보조금24API', '온통청년API') and payload ? 'policyId' order by 1`)).rows.map((r) => r.k);
ok("번호·정책이 앱 JSON 과 같다", JSON.stringify(got) === JSON.stringify(wanted), `\n      DB:   ${got.join(" | ")}\n      JSON: ${wanted.join(" | ")}`);
ok("payload.policyId 로 정책 행과 이어진다",
  await n(db, `select count(*)::int n from policy_raw r join policies p on p.policy_no = r.payload->>'policyId'`) === files.length);
ok("가져온 시각 = 응답 받은 시각",
  await n(db, `select count(*)::int n from policy_raw where payload ? 'policyId' and retrieved_at = (payload->>'fetchedAt')::timestamptz`) === files.length);
ok("원문 주소에 키가 없다", await n(db, `select count(*)::int n from policy_raw where url ~* '(serviceKey|apiKeyNm)'`) === 0);
ok("정책 표는 그대로 (버전 1 · 미검수)",
  await n(db, `select count(*)::int n from policies where version = 1 and trust_level = '미검수'`) === 16);

console.log("\n[2] 두 번 넣으면 멈추고 아무것도 안 바뀐다");
const mid = await n(db, `select count(*)::int n from policy_raw`);
let again = null;
try { await db.exec(rawSql); } catch (e) { again = e.message; }
try { await db.exec("rollback"); } catch { /* */ }
ok("'이미_넣은_원문'으로 멈춘다", /이미_넣은_원문/.test(again ?? ""), again ?? "(성공해 버림)");
ok("행 개수 그대로", await n(db, `select count(*)::int n from policy_raw`) === mid);

console.log("\n[3] 중간에 틀리면 전부 취소된다");
const db2 = await fresh();
const lastInsert = rawSql.lastIndexOf("insert into public.policy_raw");
const broken = rawSql.slice(0, lastInsert) + rawSql.slice(lastInsert).replace("'온통청년API'", "'없는종류'").replace("'보조금24API'", "'없는종류'");
let bErr = null;
try { await db2.exec(broken); } catch (e) { bErr = e.message; }
try { await db2.exec("rollback"); } catch { /* */ }
ok("마지막 1건이 틀리면 에러", /invalid input value for enum/.test(bErr ?? ""), bErr ?? "(성공해 버림)");
ok("앞의 원문도 남지 않는다", await n(db2, `select count(*)::int n from policy_raw`) === before);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
