-- ════════════════════════════════════════════════════════════════════════
-- 앱 JSON → DB 이관 (2026-11-16) — supabase/seed/build-app-fields-sql.mjs 가 만든다. 손으로 고치지 않는다.
--   앱 데이터 커밋 ebf4f61 · 설계 docs/기획/2026-11-16-정책-Supabase-읽기-설계.md
--   A. 새 칸 채우기 13건 (버전 그대로)   B. 전입 지원 2건 앱 값으로 + '운영' (버전 +1, 재검수 필요)
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
    ('moland-youth-rent-support', '2026-11-03'::date, '20260319005400112218', '161300000099', null::jsonb, null, '국토교통부 청년월세 전담 콜센터', 'https://m.bokjiro.go.kr/ssis-tem/cms/mob/customer/notice/1309500_1155.html'),
    ('iksan-youth-rent-support', '2026-11-03'::date, '20260326005400212297', null, null::jsonb, null, '익산시 주택과', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6119d0a838c019d2421dd8e1a76'),
    ('jeonbuk-youth-settlement-support', '2026-11-03'::date, '20250113005400210206', '654000000009', null::jsonb, null, '전북특별자치도 인구청년정책과', 'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=46029'),
    ('iksan-newcomer-moving-cost-support', '2026-11-03'::date, null, null, null::jsonb, null, '익산시 청년일자리과', 'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=48780'),
    ('youth-housing-benefit-split-payment', '2026-11-03'::date, '20250617005400110952', null, null::jsonb, null, 'LH 주거급여 콜센터', 'https://www.myhome.go.kr/hws/portal/cont/selectHousingBenefitView.do'),
    ('jeonse-return-guarantee-fee-subsidy', '2026-11-03'::date, '20260527005400113223', '161300000103', null::jsonb, null, '국토교통부 콜센터', 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/161300000103'),
    ('youth-btm-jeonse-loan', '2026-11-03'::date, null, null, null::jsonb, null, '주택도시보증공사(HUG) 콜센터', 'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp'),
    ('youth-btm-monthly-rent-loan', '2026-11-03'::date, null, null, null::jsonb, null, '주택도시보증공사(HUG) 콜센터', 'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020701.jsp'),
    ('iksan-youth-home-purchase-loan-interest', '2026-11-03'::date, null, null, null::jsonb, null, '익산시 주택과 주거정책계', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109bff42e5019c085e293a54be'),
    ('iksan-youth-jeonse-loan-interest', '2026-11-03'::date, null, null, null::jsonb, null, '익산시 주택과 주거정책계', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109d298170019d422a39a82c29'),
    ('iksan-public-rental-deposit-support', '2026-11-03'::date, null, null, null::jsonb, null, '익산시 주택과 주거정책계', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109c55fc84019c87cf06140511'),
    ('youth-dream-didimdol-loan', '2026-11-03'::date, null, null, null::jsonb, null, '주택도시보증공사(HUG) 콜센터', 'https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030901.jsp'),
    ('youth-dream-savings-account', '2026-11-03'::date, null, null, null::jsonb, null, '주택도시보증공사(HUG) 콜센터 — 주택도시기금 포털 문의', 'https://nhuf.molit.go.kr/FP/FP07/FP0701/FP07010301.jsp')
  ) as v(policy_no, verified_at, youth_policy_no, gov24_service_id, next_round, payout_note, label, url),
  public.agencies c
  where p.policy_no = v.policy_no and p.is_current and c.id = p.contact_id;
  get diagnostics n = row_count;
  if n <> 13 then raise exception 'A: % 건이어야 하는데 % 건', 13, n; end if;

  update public.policies set benefit_type = 'lump_sum', lump_sum_basis = 'notCalculable'
  where policy_no = 'jeonse-return-guarantee-fee-subsidy' and is_current;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A: 보증료 지원 1건이어야 하는데 % 건', n; end if;

  perform set_config('perky.sync', 'off', true);
end
$a$;

-- ── B. 전입세대 전입장려금 ─────────────────────────────────────────────
do $b$
declare n int;
begin
update public.policies p set
  name             = '전입세대 전입장려금',
  summary          = '다른 시·군·구에서 익산시로 전입한 지 6개월이 지나면 1명당 10만원을 익산 지역화폐(다이로움)로 지급 (주소전입 학생 지원과 중복 불가)',
  source_url       = 'https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2128388&bnefType=all&svcId=468100000001',
  apply_url        = 'https://www.iksan.go.kr/reserve/index.iksan',
  apply_start      = '2026-01-01'::date,
  apply_end        = null::date,
  age_min          = null,
  age_max          = null,
  statuses         = array['대학생', '재직', '구직']::public.opt_status[],
  income_bracket_min = null,
  income_bracket_max = 5,
  housing_types    = null::public.opt_housing[],
  benefit_type     = 'lump_sum',
  monthly_cap      = null,
  max_months       = null,
  lump_sum_cap     = 100000,
  lump_sum_basis   = 'fixedGrant',
  payout_note      = '전입 6개월 후 1회 지급 · 익산 지역화폐',
  exclusive_groups = array['iksan-move-in-cash-support']::text[],
  required_inputs  = array['canRegisterResidence']::text[],
  verified_at      = '2026-11-14'::date,
  youth_policy_no  = null,
  gov24_service_id = '468100000001',
  next_round       = null::jsonb,
  contact_label    = nullif('익산시청 기획예산과', (select c.name || case when c.department <> '' then ' ' || c.department else '' end from public.agencies c where c.id = p.contact_id)),
  contact_url      = nullif('https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2128388&bnefType=all&svcId=468100000001', coalesce((select c.homepage from public.agencies c where c.id = p.contact_id), '')),
  status           = '운영',
  edited_by        = 'ggue',
  edit_note        = '앱 JSON 값을 DB 로 옮김(2026-11-16, 앱 데이터 커밋 ebf4f61). 앱 값은 11/14 익산시 인구증가시책 지원 조례 별표 · 보조금24 468100000001 원문 검수를 11/15 반영한 것. 상태 보류 → 운영. 재검수 필요.'
where p.policy_no = 'iksan-move-in-household-incentive' and p.is_current;
get diagnostics n = row_count;
if n <> 1 then raise exception 'B: iksan-move-in-household-incentive 1건이어야 하는데 % 건', n; end if;
end
$b$;

-- ── B. 주소전입 학생 지원 ─────────────────────────────────────────────
do $b$
declare n int;
begin
update public.policies p set
  name             = '주소전입 학생 지원',
  summary          = '익산시 소재 대학교·대학원 재학생이 다른 시·군·구에서 익산시로 주소를 옮기면 첫 학기 30만원, 이후 학기마다 10만원씩 최대 100만원 지급 (전입세대 전입장려금과 중복 불가)',
  source_url       = 'https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2167917&bnefType=all&svcId=468100000005',
  apply_url        = 'https://www.iksan.go.kr/reserve/index.iksan',
  apply_start      = '2026-01-01'::date,
  apply_end        = null::date,
  age_min          = null,
  age_max          = null,
  statuses         = array['대학생']::public.opt_status[],
  income_bracket_min = null,
  income_bracket_max = 5,
  housing_types    = null::public.opt_housing[],
  benefit_type     = 'lump_sum',
  monthly_cap      = null,
  max_months       = null,
  lump_sum_cap     = 1000000,
  lump_sum_basis   = 'fixedGrant',
  payout_note      = '첫 학기 30만원 · 이후 학기마다 10만원',
  exclusive_groups = array['iksan-move-in-cash-support']::text[],
  required_inputs  = array['canRegisterResidence']::text[],
  verified_at      = '2026-11-14'::date,
  youth_policy_no  = null,
  gov24_service_id = '468100000005',
  next_round       = null::jsonb,
  contact_label    = nullif('익산시청 기획예산과', (select c.name || case when c.department <> '' then ' ' || c.department else '' end from public.agencies c where c.id = p.contact_id)),
  contact_url      = nullif('https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2167917&bnefType=all&svcId=468100000005', coalesce((select c.homepage from public.agencies c where c.id = p.contact_id), '')),
  status           = '운영',
  edited_by        = 'ggue',
  edit_note        = '앱 JSON 값을 DB 로 옮김(2026-11-16, 앱 데이터 커밋 ebf4f61). 앱 값은 11/14 익산시 인구증가시책 지원 조례 별표 · 보조금24 468100000005 원문 검수를 11/15 반영한 것. 상태 보류 → 운영. 재검수 필요.'
where p.policy_no = 'iksan-move-in-student-support' and p.is_current;
get diagnostics n = row_count;
if n <> 1 then raise exception 'B: iksan-move-in-student-support 1건이어야 하는데 % 건', n; end if;
end
$b$;

commit;
