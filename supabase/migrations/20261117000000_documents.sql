-- supabase/migrations/20261117000000_documents.sql
-- 정책 서류 목록 (docs/기획/2026-11-17-홈-찜하기-설계.md "4. 데이터")
-- 앱의 신청 준비 체크리스트가 서류 하나하나를 보여 준다. 비워 두면 앱은 지금의 확인 3개를 쓴다.
-- 팀이 공고 원문을 보고 입력한다(추정 금지). 내용 칸이라 고치면 고친 이유 · 버전 +1 · 미검수.

-- 모양: [{ "name": 1~60자, "note"?: 0~80자 }] 1~15개, 이름 중복 없음, 다른 키 없음
create or replace function public.is_valid_documents(d jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(d) = 'array' then (
    jsonb_array_length(d) between 1 and 15
    and not exists (
      select 1 from jsonb_array_elements(d) as e(item)
      where case
        when jsonb_typeof(e.item) <> 'object' then true
        else exists (select 1 from jsonb_object_keys(e.item) as k(key) where k.key not in ('name', 'note'))
          or coalesce(jsonb_typeof(e.item -> 'name'), '') <> 'string'
          or char_length(e.item ->> 'name') not between 1 and 60
          or btrim(e.item ->> 'name') = ''
          or (e.item ? 'note' and (coalesce(jsonb_typeof(e.item -> 'note'), '') <> 'string'
                                   or char_length(e.item ->> 'note') > 80))
      end
    )
    and (select count(distinct e.item ->> 'name') from jsonb_array_elements(d) as e(item)) = jsonb_array_length(d)
  ) else false end
$$;

alter table public.policies
  add column documents jsonb,
  add constraint 서류_형식 check (documents is null or public.is_valid_documents(documents));

comment on column public.policies.documents is '[신청] 신청 서류 목록 [{"name": "임대차계약서 사본", "note": "확정일자 포함"}]. 비우면 앱은 확인 3개(자격 · 기간 · 서류)를 쓴다';

-- 공개 함수에 documents 를 싣는다 (권한은 create or replace 가 유지)
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
      'documents',              p.documents,
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
