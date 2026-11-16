// supabase/seed/app-fields-2026-11-16.sql 을 만든다 — 손으로 고치지 말고 이 스크립트를 다시 돌린다.
//
//   node supabase/seed/build-app-fields-sql.mjs          # SQL 다시 쓰기
//   node supabase/seed/build-app-fields-sql.mjs --check  # 파일이 보관본(app-data-2026-11-16/)으로 만든 결과와 같은지만 확인
//
// 왜: 2026-11-16 부터 앱이 정책을 Supabase 에서 읽는다(docs/기획/2026-11-16-정책-Supabase-읽기-설계.md).
// 그 전에 "DB 로 만든 앱 JSON = 지금 앱 JSON" 이 되도록, 앱 JSON(데이터 커밋 ebf4f61) 값을 DB 로 옮긴다.
//
// 두 묶음
//   A. 새 칸 채우기 (공개 정책 13건) — 20261115233614_app_fields.sql 로 생긴 빈 칸에 이미 앱에 있던 값을 옮긴다.
//      값이 바뀌는 게 아니라 칸을 옮기는 이관이라 버전을 올리지 않는다(perky.sync — 확인 기록 갱신과 같은 우회).
//      보증금반환보증 보증료 지원의 지원 형태(lump_sum · notCalculable)도 여기서 — DB 규칙 때문에 비워 뒀던 값이다.
//   B. 전입 지원 2건 — DB 는 11/12 보조금24 초안('보류'), 앱은 11/14 조례 원문 검수값(11/15 반영).
//      11/15 문서 '남은 것' 1번대로 DB 를 앱 값으로 맞추고 '운영'으로 바꾼다. 내용이 바뀌므로 보통 경로
//      (고친 이유 → 버전 +1 → 미검수) — 재검수가 필요하다.
//
// 문의처: 앱의 표시 이름·주소가 문의 창구(④)의 "기관 부서"·홈페이지와 같으면 비워 둔다(nullif) — 다를 때만 정책 칸에 남는다.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 이관할 때 읽은 앱 JSON 보관본(apps/web/data @ ebf4f61). 이관 뒤 앱 JSON 은 DB 에서 다시 만들어지므로 보관본을 읽는다.
const data = (f) => JSON.parse(readFileSync(join(here, "app-data-2026-11-16", f), "utf8"));
const OUT = join(here, "app-fields-2026-11-16.sql");
const DATA_COMMIT = "ebf4f61";

const PENDING = ["iksan-move-in-household-incentive", "iksan-move-in-student-support"];

const lit = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replaceAll("'", "''") + "'";
};
const arr = (a, type) => (a == null ? `null::${type}[]` : `array[${a.map(lit).join(", ")}]::${type}[]`);
const jsonb = (v) => (v == null ? "null::jsonb" : `${lit(JSON.stringify(v))}::jsonb`);

const items = [...data("policies.json"), ...data("loan-products.json")];
const backfill = items.filter((x) => !PENDING.includes(x.id));
const pending = items.filter((x) => PENDING.includes(x.id));
if (backfill.length !== 13 || pending.length !== 2) throw new Error(`정책 수가 예상과 다르다: ${backfill.length} + ${pending.length}`);

const rowA = (x) => `    (${[
  lit(x.id), `${lit(x.verifiedAt)}::date`, lit(x.youthPolicyNo ?? null), lit(x.gov24ServiceId ?? null),
  jsonb(x.nextRound), lit(x.payoutNote ?? null), lit(x.contact?.department ?? null), lit(x.contact?.url ?? null),
].join(", ")})`;

const L = [];
L.push(`-- ════════════════════════════════════════════════════════════════════════
-- 앱 JSON → DB 이관 (2026-11-16) — supabase/seed/build-app-fields-sql.mjs 가 만든다. 손으로 고치지 않는다.
--   앱 데이터 커밋 ${DATA_COMMIT} · 설계 docs/기획/2026-11-16-정책-Supabase-읽기-설계.md
--   A. 새 칸 채우기 ${backfill.length}건 (버전 그대로)   B. 전입 지원 ${pending.length}건 앱 값으로 + '운영' (버전 +1, 재검수 필요)
--   한 묶음이다 — 중간에 에러가 나면 전부 취소된다.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── A. 새 칸 채우기 ─────────────────────────────────────────────────────
do $a$
declare n int;
begin
  perform set_config('perky.sync', 'on', true);   -- 이관이라 버전·신뢰도를 건드리지 않는다

  update public.policies p set
    verified_at      = v.verified_at,
    youth_policy_no  = v.youth_policy_no,
    gov24_service_id = v.gov24_service_id,
    next_round       = v.next_round,
    payout_note      = v.payout_note,
    contact_label    = nullif(v.label, c.name || case when c.department <> '' then ' ' || c.department else '' end),
    contact_url      = nullif(v.url, coalesce(c.homepage, ''))
  from (values
${backfill.map(rowA).join(",\n")}
  ) as v(policy_no, verified_at, youth_policy_no, gov24_service_id, next_round, payout_note, label, url),
  public.agencies c
  where p.policy_no = v.policy_no and p.is_current and c.id = p.contact_id;
  get diagnostics n = row_count;
  if n <> ${backfill.length} then raise exception 'A: % 건이어야 하는데 % 건', ${backfill.length}, n; end if;

  update public.policies set benefit_type = 'lump_sum', lump_sum_basis = 'notCalculable'
  where policy_no = 'jeonse-return-guarantee-fee-subsidy' and is_current;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A: 보증료 지원 1건이어야 하는데 % 건', n; end if;

  perform set_config('perky.sync', 'off', true);
end
$a$;
`);

for (const x of pending) {
  const d = x.discovery;
  L.push(`-- ── B. ${x.name} ─────────────────────────────────────────────
do $b$
declare n int;
begin
update public.policies p set
  name             = ${lit(x.name)},
  summary          = ${lit(x.benefitSummary)},
  source_url       = ${lit(x.sourceUrl)},
  apply_url        = ${lit(x.applyUrl)},
  apply_start      = ${lit(x.applicationStart)}::date,
  apply_end        = ${lit(x.applicationEnd)}::date,
  age_min          = ${lit(d.ageMin)},
  age_max          = ${lit(d.ageMax)},
  statuses         = ${arr(d.statuses, "public.opt_status")},
  income_bracket_min = ${lit(d.incomeBracketMin)},
  income_bracket_max = ${lit(d.incomeBracketMax)},
  housing_types    = ${arr(d.housingTypes, "public.opt_housing")},
  benefit_type     = ${lit(x.benefitType)},
  monthly_cap      = ${lit(x.monthlyCap ?? null)},
  max_months       = ${lit(x.maxMonths ?? null)},
  lump_sum_cap     = ${lit(x.lumpSumCap ?? null)},
  lump_sum_basis   = ${lit(x.lumpSumBasis ?? null)},
  payout_note      = ${lit(x.payoutNote ?? null)},
  exclusive_groups = ${arr(x.exclusiveGroup?.length ? x.exclusiveGroup : null, "text")},
  required_inputs  = ${arr(x.requiredInputs, "text")},
  verified_at      = ${lit(x.verifiedAt)}::date,
  youth_policy_no  = ${lit(x.youthPolicyNo ?? null)},
  gov24_service_id = ${lit(x.gov24ServiceId ?? null)},
  next_round       = ${jsonb(x.nextRound)},
  contact_label    = nullif(${lit(x.contact?.department ?? null)}, (select c.name || case when c.department <> '' then ' ' || c.department else '' end from public.agencies c where c.id = p.contact_id)),
  contact_url      = nullif(${lit(x.contact?.url ?? null)}, coalesce((select c.homepage from public.agencies c where c.id = p.contact_id), '')),
  status           = '운영',
  edited_by        = 'ggue',
  edit_note        = ${lit(`앱 JSON 값을 DB 로 옮김(2026-11-16, 앱 데이터 커밋 ${DATA_COMMIT}). 앱 값은 11/14 익산시 인구증가시책 지원 조례 별표 · 보조금24 ${x.gov24ServiceId} 원문 검수를 11/15 반영한 것. 상태 보류 → 운영. 재검수 필요.`)}
where p.policy_no = ${lit(x.id)} and p.is_current;
get diagnostics n = row_count;
if n <> 1 then raise exception 'B: ${x.id} 1건이어야 하는데 % 건', n; end if;
end
$b$;
`);
}
L.push(`commit;\n`);
const sql = L.join("\n");

if (process.argv.includes("--check")) {
  const now = readFileSync(OUT, "utf8");
  if (now !== sql) { console.error("app-fields-2026-11-16.sql 이 앱 JSON 으로 만든 결과와 다르다"); process.exit(1); }
  console.log("같다");
} else {
  writeFileSync(OUT, sql);
  console.log(`썼다: ${OUT} (A ${backfill.length}건 · B ${pending.length}건)`);
}
