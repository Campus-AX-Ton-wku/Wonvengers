-- ════════════════════════════════════════════════════════════════════════
-- 앱 빌드가 읽는 공개 정책 목록 — public.app_policies()
--
-- 설계: docs/기획/2026-11-16-정책-Supabase-읽기-설계.md (A안: 빌드할 때 읽기 · 공개용 함수)
--
-- 익명(anon)은 표를 직접 못 읽는다(RLS, 팀원 정책만 있음). 이 함수만 '앱 화면에 나가는 칸'을 돌려준다.
--   - 나가는 것: 공개 상태(is_current · 예정/운영) 정책의 조건 · 금액 · 기간 · 원문 주소 · 시행처 · 문의처,
--               검수 요약(확인 인원 수 · 마지막 확인일 · 확인 방법)
--   - 안 나가는 것: 내부 메모(notes) · 고친 사람/이유(edited_by · edit_note) · 검수자 이름 · 원문 본문 · 통화 기록
--   이 값들은 이미 정식 앱(wonvengers.vercel.app)의 화면 코드에 실려 공개된 것과 같은 범위다.
--
-- security definer 인 이유: anon 에게 표 읽기 권한을 열지 않고 이 함수의 결과만 주기 위해서다.
-- search_path 는 비워 두고 모든 이름을 public. 으로 적는다(Supabase 보안 경고 0011).
-- ════════════════════════════════════════════════════════════════════════

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
      'exclusive_groups',       p.exclusive_groups,
      'required_inputs',        p.required_inputs,
      'trust_level',            p.trust_level,
      'checked_at',             p.checked_at,
      'agency',                 a.name,
      'contact', case when c.id is null then null else jsonb_build_object(
        'name',        c.name,
        'department',  c.department,
        'phone',       c.phone,
        'homepage',    c.homepage,
        'verified_at', c.verified_at
      ) end,
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

comment on function public.app_policies() is
  '앱 빌드(apps/web/scripts/fetch-app-data.mjs)가 읽는 공개 정책 목록. 공개 상태 정책의 화면용 칸만 돌려준다 — 내부 메모·검수자 이름·원문 본문은 없다';

-- 기본으로 PUBLIC 에 열리는 실행 권한을 걷고, 필요한 역할에만 준다
revoke all on function public.app_policies() from public, anon, authenticated;
grant execute on function public.app_policies() to anon, authenticated, service_role;
