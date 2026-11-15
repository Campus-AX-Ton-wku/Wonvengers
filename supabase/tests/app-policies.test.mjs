// public.app_policies() — 앱 빌드가 읽는 공개 정책 목록 (migrations/20261115172640_app_policies.sql)
//
//   cd supabase/tests && node app-policies.test.mjs
//
// 표 SQL + seed + 이 함수를 PGlite 에 넣고, 익명(anon)으로 불렀을 때
//   - 공개 상태(is_current · 예정/운영) 정책만 나오는지
//   - 내부 칸(메모 · 고친 사람/이유 · 검수자 이름)이 나가지 않는지
//   - anon 은 여전히 표를 직접 못 읽는지
// 를 확인한다.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = (f) => readFileSync(join(repo, "supabase", "migrations", f), "utf8");

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra); }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;

// ── Supabase 흉내 + 표 + seed + 이 함수 ──
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(migration("20261110000000_perky_5tables.sql"));
await db.exec(readFileSync(join(repo, "supabase", "seed.sql"), "utf8"));
await db.exec(migration("20261115172640_app_policies.sql"));
await db.exec(migration("20261115233614_app_fields.sql"));

const asAnon = async (sql) => {
  await db.exec("set role anon");
  try { return await q(sql); } finally { await db.exec("reset role"); }
};

console.log("\n[1] 익명으로 부르기");
const rows = (await asAnon("select public.app_policies() as v"))[0].v;
ok("배열을 돌려준다", Array.isArray(rows));
// seed: 16건 중 '보류' 2건(새 후보)은 빠진다. 14번 연합생활관은 seed 시점엔 아직 현재 회차다.
ok("공개 상태 정책만 (seed 기준 14건)", rows.length === 14, `got ${rows.length}`);
ok("'보류' 정책은 안 나온다", !rows.some((r) => r.policy_no.startsWith("iksan-move-in-")));
ok("정책 번호 순서가 id 순", rows[0].policy_no === "moland-youth-rent-support");

console.log("\n[2] 내부 칸은 나가지 않는다");
const keys = new Set(rows.flatMap((r) => Object.keys(r)));
for (const k of ["notes", "edited_by", "edit_note", "raw_id", "edited_at"]) {
  ok(`'${k}' 없음`, !keys.has(k));
}
const text = JSON.stringify(rows);
ok("seed 메모 글자가 섞이지 않는다", !text.includes("[seed]") && !text.includes("[JSON 기타 칸]"));

console.log("\n[3] 화면에 필요한 칸");
const moland = rows.find((r) => r.policy_no === "moland-youth-rent-support");
ok("시행처 이름", moland.agency === "국토교통부");
ok("문의처", moland.contact?.phone === "1599-0001" && moland.contact?.department === "청년월세 전담 콜센터");
ok("검수 요약 (seed 는 확인 0)", moland.checks.confirmers === 0 && Array.isArray(moland.checks.methods));
ok("날짜는 YYYY-MM-DD 글자", moland.apply_start === "2026-03-30");

console.log("\n[4] anon 은 여전히 표를 직접 못 읽는다 (RLS)");
ok("policies 0행", (await asAnon("select count(*)::int n from public.policies"))[0].n === 0);
ok("policy_checks 0행", (await asAnon("select count(*)::int n from public.policy_checks"))[0].n === 0);

console.log("\n[5] 실행 권한");
const canExec = async (role) =>
  (await q(`select has_function_privilege('${role}', 'public.app_policies()', 'execute') as v`))[0].v;
ok("anon · authenticated · service_role 실행 가능",
  (await canExec("anon")) && (await canExec("authenticated")) && (await canExec("service_role")));
ok("PUBLIC 에는 열려 있지 않다",
  (await q(`select coalesce(bool_or(a.grantee = 0), false) as v
            from pg_proc p, aclexplode(p.proacl) a where p.proname = 'app_policies'`))[0].v === false);

console.log("\n[6] 새 칸 (20261115233614_app_fields.sql)");
for (const k of ["verified_at", "youth_policy_no", "gov24_service_id", "next_round", "payout_note", "contact_label", "contact_url"]) {
  ok(`'${k}' 가 나온다`, k in moland);
}
const tryUpdate = async (sql) => {
  try { await db.exec(sql); return null; } catch (e) { return e.message; }
};
ok("보증료도 지원 형태를 가질 수 있다", await tryUpdate(`
  update policies set benefit_type = 'lump_sum', lump_sum_basis = 'notCalculable', edit_note = '검사: 보증료 지원 형태'
  where policy_no = 'jeonse-return-guarantee-fee-subsidy'`) === null);
ok("대출은 여전히 지원 형태를 못 가진다", (await tryUpdate(`
  update policies set benefit_type = 'lump_sum', lump_sum_basis = 'notCalculable', edit_note = '검사'
  where policy_no = 'youth-btm-jeonse-loan'`))?.includes("현금만_지원형태"));
ok("다음 회차 형식이 틀리면 거부", (await tryUpdate(`
  update policies set next_round = '{"text": "내년", "confirmedAt": "2027", "via": "공고"}', edit_note = '검사'
  where policy_no = 'moland-youth-rent-support'`))?.includes("다음회차_형식"));
ok("다음 회차 형식이 맞으면 통과", await tryUpdate(`
  update policies set next_round = '{"text": "2027년 4월 공고 예정", "confirmedAt": "2026-11-16", "via": "전화"}', edit_note = '검사: 다음 회차'
  where policy_no = 'moland-youth-rent-support'`) === null);
const v = await q(`select version, trust_level from policies where policy_no = 'moland-youth-rent-support'`);
ok("새 칸도 내용 칸 — 고치면 버전이 오른다", v[0].version === 2 && v[0].trust_level === "미검수");
const after = (await asAnon("select public.app_policies() as v"))[0].v.find((r) => r.policy_no === "moland-youth-rent-support");
ok("고친 다음 회차가 함수에 나온다", after.next_round?.via === "전화");

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
