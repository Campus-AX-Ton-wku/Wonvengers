-- ════════════════════════════════════════════════════════════════════════
-- 앱이 쓰는데 DB 에 없던 칸 + 보증료 지원 형태 허용 + app_policies() 에 새 칸 싣기
--
-- 설계: docs/기획/2026-11-16-정책-Supabase-읽기-설계.md "1. DB" · 11/16 대조 결과
-- 전부 추가·완화만 한다. 기존 칸·쿼리(match_policies · 멘토 점검 쿼리)는 그대로다.
--
-- 새 칸은 모두 '내용 칸'이다 — 고치면 지금처럼 고친 이유가 필요하고, 버전이 오르고, 미검수가 된다
-- (trg_policies_update 의 관리칸 목록은 바꾸지 않는다).
-- ════════════════════════════════════════════════════════════════════════

alter table public.policies
  add column verified_at      date,
  add column youth_policy_no  text,
  add column gov24_service_id text,
  add column next_round       jsonb,
  add column payout_note      text,
  add column contact_label    text,
  add column contact_url      text;

alter table public.policies
  add constraint 다음회차_형식 check (
    next_round is null or (
      jsonb_typeof(next_round) = 'object'
      and jsonb_typeof(next_round -> 'text') = 'string'
      and (next_round ->> 'confirmedAt') ~ '^\d{4}-\d{2}-\d{2}$'
      and (next_round ->> 'via') in ('공고', '전화')
    )
  ),
  add constraint 문의주소_형식 check (contact_url is null or contact_url ~ '^https?://');

-- 보증금반환보증 보증료 지원은 '보증료'지만 금액 계산(2층)에 들어간다 → 지원 형태가 필요하다.
-- 앱 변환 규칙: benefit_type 이 있으면 금액 계산 정책(policies.json), 없으면 안내 상품(loan-products.json).
alter table public.policies
  drop constraint 현금만_지원형태,
  add constraint 현금만_지원형태 check (kind in ('현금', '보증료') or benefit_type is null);

comment on column public.policies.verified_at      is '[신뢰] 팀이 공고 원문과 대조한 날(앱 화면의 확인일). 확인 기록(⑤)에 이 버전의 일치가 있으면 그 날짜가 우선한다';
comment on column public.policies.youth_policy_no  is '[원문] 온통청년 정책번호(plcyNo). 화면에 안 나온다 — 후보 발굴 스크립트가 쓴다';
comment on column public.policies.gov24_service_id is '[원문] 보조금24 서비스ID. 화면에 안 나온다 — 매주 신선도 점검이 쓴다';
comment on column public.policies.next_round       is '[기간] 마감 회차의 다음 일정 {"text": "2027년 4월 공고 예정", "confirmedAt": "YYYY-MM-DD", "via": "공고"|"전화"}. 확인한 경우에만';
comment on column public.policies.payout_note      is '[금액] 일시금이 1회 지급이 아닐 때 화면에 적는 한 줄 (예: 첫 학기 30만원 · 이후 학기마다 10만원)';
comment on column public.policies.contact_label    is '[기관] 화면에 보일 문의처 이름. 비우면 문의 창구(④)의 "기관 부서"';
comment on column public.policies.contact_url      is '[기관] 이 정책의 문의 안내 주소. 비우면 문의 창구(④)의 홈페이지';

-- ── 공개용 함수에 새 칸 싣기 (20261115172640_app_policies.sql 의 다음 판) ──
create or replace function public.app_policies()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.row_data order by s.id), '[]'::jsonb)
  from (
    select p.id, jsonb_build_object(
      'policy_no',              p.policy_no,
      'year',                   p.year,
      'version',                p.version,
      'kind',                   p.kind,
      'status',                 p.status,
      'name',                   p.name,
      'summary',                p.summary,
      'source_url',             p.source_url,
      'apply_url',              p.apply_url,
      'apply_start',            p.apply_start,
      'apply_end',              p.apply_end,
      'next_round',             p.next_round,
      'age_min',                p.age_min,
      'age_max',                p.age_max,
      'age_military_extension', p.age_military_extension,
      'region_codes',           p.region_codes,
      'region_label',           p.region_label,
      'statuses',               p.statuses,
      'income_bracket_min',     p.income_bracket_min,
      'income_bracket_max',     p.income_bracket_max,
      'housing_types',          p.housing_types,
      'benefit_type',           p.benefit_type,
      'monthly_cap',            p.monthly_cap,
      'max_months',             p.max_months,
      'lump_sum_cap',           p.lump_sum_cap,
      'lump_sum_basis',         p.lump_sum_basis,
      'payout_note',            p.payout_note,
      'exclusive_groups',       p.exclusive_groups,
      'required_inputs',        p.required_inputs,
      'youth_policy_no',        p.youth_policy_no,
      'gov24_service_id',       p.gov24_service_id,
      'trust_level',            p.trust_level,
      'checked_at',             p.checked_at,
      'verified_at',            p.verified_at,
      'agency',                 a.name,
      'contact', case when c.id is null then null else jsonb_build_object(
        'name',        c.name,
        'department',  c.department,
        'phone',       c.phone,
        'homepage',    c.homepage,
        'verified_at', c.verified_at
      ) end,
      'contact_label',          p.contact_label,
      'contact_url',            p.contact_url,
      'checks', jsonb_build_object(
        'confirmers',        k.confirmers,
        'last_confirmed_at', k.last_confirmed_at,
        'methods',           k.methods
      )
    ) as row_data
    from public.policies p
    join public.agencies a on a.id = p.agency_id
    left join public.agencies c on c.id = p.contact_id
    -- scripts/verification-snapshot.sql 과 같은 기준: 지금 버전에 '일치'를 남긴 원문대조·전화문의만 센다
    cross join lateral (
      select count(distinct btrim(x.checked_by))::int as confirmers,
             to_char(max(x.checked_at) at time zone 'Asia/Seoul', 'YYYY-MM-DD') as last_confirmed_at,
             coalesce(jsonb_agg(distinct x.method) filter (where x.method is not null), '[]'::jsonb) as methods
      from public.policy_checks x
      where x.policy_id = p.id and x.policy_version = p.version
        and x.method in ('원문대조', '전화문의') and x.result = '일치'
    ) k
    where p.is_current and p.status in ('예정', '운영')
  ) s
$$;
