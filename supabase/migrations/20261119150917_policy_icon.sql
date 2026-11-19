-- supabase/migrations/20261119150917_policy_icon.sql
-- 정책 종류 아이콘 (11/20) — 앱의 지원금 목록 · 상세 · 찜 · 결과 카드에 정책마다 3D 아이콘 하나
--
-- 설계: 2026-11-18 디자인 시안 '3D 아이콘 설계' 1순위 "지원금 카드의 정책 종류" — 정책 데이터에 아이콘 종류 칸이 필요하다.
-- 그림은 앱(apps/web/public/icons3d/<이름>.webp)에 있고, DB 는 이름만 고른다. 고를 수 있는 이름은 아래 종류(enum)로
-- 막는다 — Table Editor 에서 목록으로 고르고, 앱에 없는 그림 이름은 저장되지 않는다.
--
-- 관리칸으로 둔다. 아이콘은 공고 원문에서 온 값이 아니라 화면에 붙는 그림이라, 바꿔도 고친 이유 · 버전 +1 · 미검수가
-- 필요 없다(원문 대조로 '검수'가 된 정책이 그림 하나 바꿨다고 미검수로 돌아가면 안 된다).
-- 공개 정책인데 비어 있으면 앱 빌드가 멈추고 고칠 칸을 알려 준다(apps/web/scripts/app-data/from-db.mjs).

create type public.policy_icon as enum (
  'rent',            -- 월세 지원
  'moving',          -- 이사비 · 중개보수
  'move-in',         -- 전입 지원
  'housing-benefit', -- 주거급여
  'guarantee',       -- 보증료 지원
  'student',         -- 학생 지원
  'settle',          -- 정착 지원
  'loan',            -- 대출 · 이자 지원
  'bankbook'         -- 청약 · 저축
);

alter table public.policies add column icon public.policy_icon;

comment on column public.policies.icon is '[화면] 정책 종류 아이콘. 앱 public/icons3d/<이름>.webp 를 그린다. 관리칸 — 바꿔도 버전 · 검수 상태가 그대로다. 공개 정책은 꼭 고른다(비면 앱 빌드가 멈춘다)';

-- 관리칸에 icon 을 더한다 (20261110000000_perky_5tables.sql 의 다음 판 · search_path 는 20261114150805 그대로)
create or replace function public.trg_policies_update() returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  관리칸 constant text[] := array['version', 'edited_at', 'edited_by', 'edit_note',
                                  'checked_at', 'check_result', 'trust_level', 'is_current', 'status', 'icon'];
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
  new.edited_at := now();
  return new;
end $$;

-- 지금 정책의 아이콘 (시안 '정책 종류 8개' + 청약통장은 통장 그림)
update public.policies p
set icon = v.icon::public.policy_icon
from (values
  ('moland-youth-rent-support',           'rent'),
  ('iksan-youth-rent-support',            'rent'),
  ('iksan-newcomer-moving-cost-support',  'moving'),
  ('iksan-move-in-household-incentive',   'move-in'),
  ('iksan-move-in-student-support',       'student'),  -- 전입장려금(move-in)과 목록에서 구분되게
  ('youth-housing-benefit-split-payment', 'housing-benefit'),
  ('jeonse-return-guarantee-fee-subsidy', 'guarantee'),
  ('jeonbuk-youth-settlement-support',    'settle'),
  ('youth-dream-savings-account',         'bankbook')
) as v(policy_no, icon)
where p.policy_no = v.policy_no;

update public.policies set icon = 'loan' where kind = '대출';

-- 공개 함수에 icon 을 싣는다 (20261116233659_documents.sql 의 다음 판, 권한은 create or replace 가 유지)
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
