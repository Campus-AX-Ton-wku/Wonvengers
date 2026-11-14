// 공고문 원문(supabase/raw/notice-<날짜>/*.json)을 원문 표(policy_raw)에 '공고문'으로 넣는 SQL 을 만든다.
//
//   node supabase/raw/build-notice-sql.mjs 2026-11-14          # supabase/raw/notice-2026-11-14.sql 쓰기
//   node supabase/raw/build-notice-sql.mjs 2026-11-14 --check  # 지금 원문 파일과 같은지만 확인
//
// - JSON 한 개 = 정책 하나에 쓴 공고문 하나. text 는 원본 파일에서 뽑은 글자 그대로다. 이 스크립트는 고르거나 고치지 않는다.
// - 원본 파일(hwp·pdf)은 git 에 넣지 않는다. Storage 의 archivePath 위치에 손으로 올린다(file.md5 로 같은 파일인지 확인).
// - 원문 표는 고치거나 지울 수 없다 → 한 번만 실행. 같은 정책·주소의 공고문이 이미 있으면 멈춘다.
// - 정책 행(policies.raw_id)은 건드리지 않는다(바꾸면 정책 버전이 올라 검수가 무효가 된다). payload.policyId 로 잇는다.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const day = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) { console.error("날짜를 주세요: node supabase/raw/build-notice-sql.mjs 2026-11-14"); process.exit(1); }
const dir = join(here, `notice-${day}`);
const OUT = join(here, `notice-${day}.sql`);

const lit = (v) => (v == null ? "null" : "'" + String(v).replaceAll("'", "''") + "'");
const rows = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
  for (const k of ["policyId", "title", "url", "archivePath", "retrievedAt", "retrievedBy", "text"])
    if (!r[k]) throw new Error(`${f}: ${k} 가 없다`);
  if (f !== `${r.policyId}.json`) throw new Error(`${f}: 파일 이름 = policyId.json 이어야 한다`);
  if (!/^https?:\/\//.test(r.url)) throw new Error(`${f}: url 형식`);
  if (!/^source-files\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/.test(r.archivePath)) throw new Error(`${f}: archivePath 는 영문·숫자만 (Storage 키)`);
  if (!/^[0-9a-f]{32}$/.test(r.file?.md5 ?? "")) throw new Error(`${f}: file.md5 가 없다`);
  const payload = { policyId: r.policyId, text: r.text, file: r.file, extractedBy: r.extractedBy };
  rows.push({ ...r, payload });
}
if (!rows.length) throw new Error(`${dir} 에 원문 파일이 없다`);

const keys = rows.map((r) => `(${lit(r.policyId)}, ${lit(r.url)})`).join(", ");
const L = [`-- ════════════════════════════════════════════════════════════════════════
-- Perky DB — 공고문 원문 ${rows.length}건 (${day} 받은 원본 파일) → 원문 표(policy_raw)
--
--   ⚠️ supabase/raw/build-notice-sql.mjs 가 supabase/raw/notice-${day}/ 의 JSON 으로 만든다. 손으로 고치지 않는다.
--   ⚠️ 한 번만 실행한다. 같은 정책·주소의 공고문이 이미 있으면 맨 앞에서 멈추고 아무것도 넣지 않는다.
--      중간에 에러가 나면 전부 취소된다(한 묶음). 정책 표는 건드리지 않는다.
--   적용: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여 넣기 → Run
--   미리 검사: cd supabase/tests && node notice.test.mjs
--   원본 파일은 각 행의 archive_path 위치에 Storage(source-files 버킷)로 올린다.
--
--   ${rows.map((r) => `${r.policyId} ← ${r.archivePath.split("/").pop()}`).join("\n--   ")}
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if exists (select 1 from public.policy_raw where kind = '공고문' and (payload->>'policyId', url) in (${keys})) then
    raise exception '이미_넣은_원문' using hint = '이 공고문 원문은 이미 들어가 있다. 다시 실행하지 않는다.';
  end if;
end $$;
`];
for (const r of rows) {
  L.push(`-- ${r.policyId} · ${r.file.name} (${r.file.bytes} bytes)
insert into public.policy_raw (kind, external_id, title, url, payload, archive_path, retrieved_at, retrieved_by) values (
  '공고문', null, ${lit(r.title)}, ${lit(r.url)},
  ${lit(JSON.stringify(r.payload))}::jsonb,
  ${lit(r.archivePath)}, ${lit(r.retrievedAt)}, ${lit(r.retrievedBy)});`);
}
L.push(`
do $$
begin
  if (select count(*) from public.policy_raw where kind = '공고문' and (payload->>'policyId', url) in (${keys})) <> ${rows.length} then
    raise exception '원문_개수_불일치';
  end if;
end $$;

commit;
`);
const sql = L.join("\n");

// 붙여 넣기 때 줄바꿈이 바뀌어도 값이 같도록, 글자 값 안에는 줄바꿈이 없어야 한다 (본문 줄바꿈은 JSON 안에서 \\n)
for (const r of rows) for (const v of [r.title, r.url, r.archivePath, r.retrievedBy, JSON.stringify(r.payload)])
  if (/[\r\n]/.test(v)) throw new Error(`${r.policyId}: 값 안에 줄바꿈이 있다`);
if (/serviceKey|apiKeyNm/i.test(sql)) throw new Error("API 키 칸 이름이 SQL 에 들어갔다 — 쓰지 않는다");

if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== sql) { console.error(`notice-${day}.sql 이 원문 파일과 다르다 → 다시 만들 것`); process.exit(1); }
  console.log(`notice-${day}.sql 최신`);
} else {
  writeFileSync(OUT, sql);
  console.log(`notice-${day}.sql 작성: 공고문 ${rows.length}건 (${Math.round(sql.length / 1024)} KB)`);
}
