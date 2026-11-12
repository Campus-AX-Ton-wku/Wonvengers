// API 원문 응답(supabase/raw/<날짜>/*.json)을 원문 표(policy_raw)에 넣는 SQL 을 만든다. (계획서 할 일 7번)
//
//   node supabase/raw/build-raw-sql.mjs 2026-11-12          # supabase/raw/2026-11-12.sql 쓰기
//   node supabase/raw/build-raw-sql.mjs 2026-11-12 --check  # 지금 원문 파일과 같은지만 확인
//
// - 응답은 받은 그대로 넣는다. 이 스크립트는 값을 고르거나 고치지 않는다.
// - 원문 표는 고치거나 지울 수 없다 → 한 번만 실행. 이미 같은 번호의 원문이 있으면 멈춘다.
// - 원문 행은 정책 행을 직접 가리키지 않는다(policies.raw_id 를 바꾸면 정책 버전이 오른다).
//   대신 payload.policyId 에 앱 JSON 의 id(= policies.policy_no)를 적어 둔다.
//     select p.policy_no, r.kind, r.external_id, r.retrieved_at
//     from policy_raw r join policies p on p.policy_no = r.payload->>'policyId';

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const day = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) { console.error("날짜 폴더를 주세요: node supabase/raw/build-raw-sql.mjs 2026-11-12"); process.exit(1); }
const dir = join(here, day);
const OUT = join(here, `${day}.sql`);

const lit = (v) => (v == null ? "null" : "'" + String(v).replaceAll("'", "''") + "'");
const rows = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (!raw.policyId || !raw.fetchedAt) throw new Error(`${f}: policyId·fetchedAt 이 없다`);
  if (f.startsWith("gov24-")) {
    const id = raw.query["cond[서비스ID::EQ]"];
    const det = raw.serviceDetail?.data?.[0], lst = raw.serviceList?.data?.[0];
    if (det?.["서비스ID"] !== id || lst?.["서비스ID"] !== id) throw new Error(`${f}: 응답의 서비스ID 가 요청과 다르다`);
    rows.push({ kind: "보조금24API", external_id: id, title: det["서비스명"], url: lst["상세조회URL"], payload: raw,
      retrieved_at: raw.fetchedAt, retrieved_by: `노찬영 PC Claude (보조금24 API, raw/${day}/)` });
  } else if (f.startsWith("youth-")) {
    const no = raw.query.plcyNo;
    const hit = (raw.response?.result?.youthPolicyList ?? []).filter((p) => p.plcyNo === no);
    if (hit.length !== 1) throw new Error(`${f}: 응답에 plcyNo ${no} 가 ${hit.length}건`);
    // 온통청년은 정책별 고정 상세 주소를 API 가 주지 않는다 → 키를 뺀 API 요청 주소를 원문 주소로 쓴다
    rows.push({ kind: "온통청년API", external_id: no, title: hit[0].plcyNm,
      url: `https://www.youthcenter.go.kr/go/ythip/getPlcy?rtnType=json&plcyNo=${no}`, payload: raw,
      retrieved_at: raw.fetchedAt, retrieved_by: `노찬영 PC Claude (온통청년 API, raw/${day}/)` });
  } else throw new Error(`${f}: 모르는 파일 이름 (gov24-* 또는 youth-*)`);
}
if (!rows.length) throw new Error(`${dir} 에 원문 파일이 없다`);

const keys = rows.map((r) => `(${lit(r.kind)}, ${lit(r.external_id)})`).join(", ");
const L = [`-- ════════════════════════════════════════════════════════════════════════
-- Perky DB — API 원문 ${rows.length}건 (${day} 조회) → 원문 표(policy_raw)
--
--   ⚠️ supabase/raw/build-raw-sql.mjs 가 supabase/raw/${day}/ 의 응답 파일로 만든다. 손으로 고치지 않는다.
--   ⚠️ 한 번만 실행한다. 같은 번호의 원문이 이미 있으면 맨 앞에서 멈추고 아무것도 넣지 않는다.
--      중간에 에러가 나면 전부 취소된다(한 묶음).
--   적용: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여 넣기 → Run
--   미리 검사: cd supabase/tests && node raw.test.mjs
--
--   ${rows.map((r) => `${r.kind} ${r.external_id} ${r.payload.policyId}`).join("\n--   ")}
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if exists (select 1 from public.policy_raw where (kind::text, external_id) in (${keys})) then
    raise exception '이미_넣은_원문' using hint = '이 날짜의 API 원문은 이미 들어가 있다. 다시 실행하지 않는다.';
  end if;
end $$;
`];
for (const r of rows) {
  L.push(`-- ${r.payload.policyId} · ${r.kind} ${r.external_id}
insert into public.policy_raw (kind, external_id, title, url, payload, retrieved_at, retrieved_by) values (
  ${lit(r.kind)}, ${lit(r.external_id)}, ${lit(r.title)}, ${lit(r.url)},
  ${lit(JSON.stringify(r.payload))}::jsonb,
  ${lit(r.retrieved_at)}, ${lit(r.retrieved_by)});`);
}
L.push(`
do $$
begin
  if (select count(*) from public.policy_raw where (kind::text, external_id) in (${keys})) <> ${rows.length} then
    raise exception '원문_개수_불일치';
  end if;
end $$;

commit;
`);
const sql = L.join("\n");

// 붙여 넣기 때 줄바꿈이 바뀌어도 값이 같도록, 글자 값 안에는 줄바꿈이 없어야 한다
for (const r of rows) for (const v of [r.title, r.url, r.retrieved_by, JSON.stringify(r.payload)])
  if (/[\r\n]/.test(v)) throw new Error(`${r.external_id}: 값 안에 줄바꿈이 있다`);
if (/serviceKey|apiKeyNm/i.test(sql)) throw new Error("API 키 칸 이름이 SQL 에 들어갔다 — 쓰지 않는다");

if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== sql) { console.error(`${day}.sql 이 원문 파일과 다르다 → 다시 만들 것`); process.exit(1); }
  console.log(`${day}.sql 최신`);
} else {
  writeFileSync(OUT, sql);
  console.log(`${day}.sql 작성: 원문 ${rows.length}건 (${rows.map((r) => r.kind).join(", ")})`);
}
