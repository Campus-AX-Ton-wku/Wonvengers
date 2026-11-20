-- supabase/migrations/20261120054504_policy_published_at.sql
-- 정책이 처음 앱에 보인 때 (11/20) — 앱 알림함의 '새 지원금' (docs/기획/2026-11-20-알림함-설계.md)
--
-- edited_at 은 고칠 때마다 바뀌어 '올라온 날'이 될 수 없다(11/19 아이콘 작업으로 16건 모두 11/19).
-- 행이 처음으로 앱에 보이는 상태(is_current · 예정/운영)가 되는 순간 자동으로 찍는다 — 팀이 따로 적지 않는다.
-- 지금 보이는 정책은 비워 둔다: 알림 서버가 11/16 첫 실행 때 '이미 있던 정책'으로 기준선을 잡아 새 정책으로 알리지 않았다.
-- 관리칸이다 — 바꿔도 고친 이유 · 버전 +1 · 미검수가 필요 없다(원문에서 온 값이 아니다).

alter table public.policies add column published_at timestamptz;

comment on column public.policies.published_at is '[화면] 정책이 처음으로 앱에 보이는 상태(지금 회차 · 예정/운영)가 된 때. 자동으로 찍힌다. 관리칸. 11/20 이전부터 보이던 정책은 비워 둔다(알림 기준선)';

-- 새로 등록할 때 (20261110000000_perky_5tables.sql 의 다음 판 · search_path 는 20261114150805 그대로)
create or replace function public.trg_policies_insert() returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.version      := 1;
  new.edited_at    := now();
  new.checked_at   := null;
  new.check_result := null;
  new.trust_level  := '미검수';
  if new.published_at is null and coalesce(new.is_current, false) and new.status in ('예정', '운영') then
    new.published_at := now();
  end if;
  return new;
end $$;

-- 고칠 때 (20261119150917_policy_icon.sql 의 다음 판) — 관리칸에 published_at, 보이지 않던 행이 보이게 되면 찍는다
create or replace function public.trg_policies_update() returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  관리칸 constant text[] := array['version', 'edited_at', 'edited_by', 'edit_note',
                                  'checked_at', 'check_result', 'trust_level', 'is_current', 'status', 'icon',
                                  'published_at'];
begin
  if current_setting('perky.sync', true) = 'on' then
    return new;  -- 확인 기록(⑤)이 신뢰 칸을 갱신하는 중
  end if;
  new.checked_at   := old.checked_at;    -- 신뢰 칸은 손으로 못 바꾼다
  new.check_result := old.check_result;
  new.trust_level  := old.trust_level;
  new.version      := old.version;
  if (to_jsonb(new) - 관리칸) is distinct from (to_jsonb(old) - 관리칸) then
    if new.edit_note is not distinct from old.edit_note then
      raise exception '고친_이유_필수'
        using hint = 'edit_note 에 고친 이유와 원문 위치를 새로 적으세요.';
    end if;
    new.version     := old.version + 1;
    new.trust_level := '미검수';
  end if;
  if new.published_at is null
     and coalesce(new.is_current, false) and new.status in ('예정', '운영')
     and not (coalesce(old.is_current, false) and old.status in ('예정', '운영')) then
    new.published_at := now();
  end if;
  new.edited_at := now();
  return new;
end $$;

-- 공개 함수에 published_at 을 싣는다 (20261119150917_policy_icon.sql 의 다음 판, 권한은 create or replace 가 유지)
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
      'icon',                   p.icon,
      'published_at',           p.published_at,
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
