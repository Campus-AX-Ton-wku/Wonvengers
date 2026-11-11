-- ════════════════════════════════════════════════════════════════════
-- 1단계 — 정책 데이터 + 팀 검수
--
-- 만드는 것 (Supabase Table Editor 에서 이름순으로 이렇게 묶여 보인다)
--
--   data_   앱이 쓰는 데이터. 배포 전에 JSON 으로 뽑아 apps/web/data/ 에 넣는다
--     data_income_brackets     1층 소득 구간
--     data_income_thresholds   기준 중위소득표
--     data_loan_products       대출·보증 상품 안내
--     data_policies            정책
--
--   team_   팀이 데이터를 고치고 검수한 기록
--     team_change_log          변경 이력 (자동 기록)
--     team_members             팀원 명단
--     team_review_queue        검수 대기 목록 (뷰)
--     team_reviews             검수 기록
--
--   opt_    정해진 값만 들어가는 칸의 선택지. Table Editor 에서 드롭다운으로 보인다
--
-- data_ 표의 칸 순서는 모두 같다:  [식별] → [내용] → [관리 4칸]
--   관리 4칸 = version · edited_at · edited_by · edit_note
--   트리거가 채운다. 사람이 적는 것은 edit_note(고친 이유) 하나뿐이다.
--
-- 사용자 화면은 DB 를 읽지 않는다(정적 JSON). 이 단계는 개인정보를 다루지 않는다.
-- ════════════════════════════════════════════════════════════════════


-- ── 0. 선택지 (opt_) ─────────────────────────────────────────────────
-- 정해진 값만 들어가는 칸은 글자(text) 대신 선택지 타입으로 둔다. Table Editor 에서
-- 직접 치지 않고 목록에서 고르게 되어 오타가 들어갈 수 없다.
--   값 추가:  alter type public.opt_xxx add value '새값';
--   값을 빼거나 이름을 바꾸는 것은 어렵다 — 쓰는 행이 없는지 먼저 확인하고 팀과 정할 것.

create type public.opt_team_role         as enum ('member', 'admin');
create type public.opt_publish_status    as enum ('draft', 'published', 'archived');
create type public.opt_benefit_type      as enum ('rent_capped_monthly', 'flat_monthly', 'lump_sum');
create type public.opt_lump_sum_basis    as enum ('oneTimeMoveCost', 'notCalculable');
create type public.opt_product_type      as enum ('loan_interest_subsidy', 'guarantee_fee_subsidy');
create type public.opt_discovery_status  as enum ('대학생', '재직', '구직');
create type public.opt_housing_type      as enum ('월세', '연세', '전세', '그 외');
create type public.opt_review_result     as enum ('confirmed', 'needs_fix');
create type public.opt_change_action     as enum ('insert', 'update', 'delete');
-- 값은 lib/types.ts 의 EligibilityProfile 키와 같아야 한다.
create type public.opt_eligibility_input as enum (
  'birthDate', 'isStudentOrEmployed', 'livesApartFromParents', 'canRegisterResidence',
  'hasNoHouse', 'isContractHolder', 'householdSize', 'useOriginHousehold',
  'ownHouseholdMonthlyIncome', 'originHouseholdMonthlyIncome', 'assetsUnder107M',
  'isBasicLivelihoodRecipient', 'isNearPovertyClass', 'receivingOtherRentSupport',
  'jeonbukResidentOverOneYear', 'employedInTargetSectorOver3Months'
);

comment on type public.opt_team_role         is '팀원 역할 — member: 데이터 수정·검수 / admin: 여기에 더해 팀원 관리';
comment on type public.opt_publish_status    is '게시 상태 — draft: 작성 중(앱에 안 나감) / published: 앱에 나감 / archived: 내림';
comment on type public.opt_benefit_type      is '지원 형태 — rent_capped_monthly: 실제 월세 범위 내 월 상한 / flat_monthly: 월 정액 / lump_sum: 일시금';
comment on type public.opt_lump_sum_basis    is '일시금 계산 기준 — oneTimeMoveCost: 입력한 이사비·중개보수 / notCalculable: 계산하지 않음';
comment on type public.opt_product_type      is '상품 종류 — loan_interest_subsidy: 대출·이자 지원 / guarantee_fee_subsidy: 보증료 지원';
comment on type public.opt_discovery_status  is '1층 현재 상태 선택지';
comment on type public.opt_housing_type      is '1층 주거 형태 선택지';
comment on type public.opt_review_result     is '검수 결과 — confirmed: 원문과 일치 / needs_fix: 고칠 곳 있음';
comment on type public.opt_change_action     is '변경 종류 — insert: 추가 / update: 수정 / delete: 삭제';
comment on type public.opt_eligibility_input is '2층에서 묻는 항목. lib/types.ts EligibilityProfile 의 키';


-- ── 1. 팀원 ──────────────────────────────────────────────────────────

create table public.team_members (
  user_id      uuid not null,
  display_name text not null,
  role         public.opt_team_role not null default 'member',
  is_active    boolean not null default true,
  joined_at    timestamptz not null default now(),

  primary key (user_id),
  constraint "로그인_계정" foreign key (user_id) references auth.users (id),
  constraint "이름_필수"   check (btrim(display_name) <> '')
);

comment on table  public.team_members              is '팀원 명단. 한 행 = 팀원 한 명. 검수 기록의 근거라 지우지 않고, 그만두면 is_active 를 false 로 둔다';
comment on column public.team_members.user_id      is 'Supabase 로그인 계정 id (auth.users.id)';
comment on column public.team_members.display_name is '화면·검수 현황에 보이는 이름';
comment on column public.team_members.role         is 'member = 데이터 수정·검수 / admin = 여기에 더해 팀원 추가·수정';
comment on column public.team_members.is_active    is 'false 면 더 이상 수정·검수할 수 없다';
comment on column public.team_members.joined_at    is '명단에 추가된 시각';

create function public.is_team_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.is_active);
$$;

create function public.is_team_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.is_active and m.role = 'admin');
$$;

comment on function public.is_team_member() is '지금 로그인한 사람이 활동 중인 팀원인가 (권한 규칙에서 쓴다)';
comment on function public.is_team_admin()  is '지금 로그인한 사람이 admin 인가 (권한 규칙에서 쓴다)';


-- ── 2. 공통 트리거 ───────────────────────────────────────────────────
-- 이름이 trg_ 로 시작하는 함수는 트리거 전용이다. 직접 부르지 않는다.

-- data_ 표에 붙는다. 내용이 바뀌면 version 을 올리고 누가 고쳤는지 적는다.
-- 인자: 그 표의 키 칸 이름.
create function public.trg_track_version()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  key_col   text := tg_argv[0];
  -- 이 칸만 바뀌면 '내용 변경'이 아니다. 게시·순서를 바꿨다고 검수가 무효가 되면 안 된다.
  meta_cols text[] := array['version', 'edited_at', 'edited_by', 'edit_note', 'status', 'sort_order', 'is_active'];
  actor     uuid := auth.uid();
  -- seed.sql 이 JSON 을 옮겨 넣을 때만 켠다. 그때는 작성자를 알 수 없다.
  importing boolean := coalesce(current_setting('perky.import_mode', true), '') = 'on';
  label     text := format('%s(%s)', tg_table_name, to_jsonb(new) ->> key_col);
begin
  if tg_op = 'INSERT' then
    new.version   := 1;
    new.edited_at := now();
    new.edited_by := coalesce(actor, new.edited_by);
  else
    if (to_jsonb(new) ->> key_col) is distinct from (to_jsonb(old) ->> key_col) then
      raise exception '%: 키(%)는 바꿀 수 없습니다. 새 행을 만들고 기존 행은 archived 로 두세요', tg_table_name, key_col;
    end if;

    if (to_jsonb(new) - meta_cols) = (to_jsonb(old) - meta_cols) then
      new.version   := old.version;
      new.edited_at := old.edited_at;
      new.edited_by := old.edited_by;
      return new;
    end if;

    if new.edit_note is not distinct from old.edit_note and not importing then
      raise exception '%: 내용을 고칠 때는 고친 이유(edit_note)를 새로 적어 주세요', label;
    end if;

    new.version   := old.version + 1;
    new.edited_at := now();
    -- Studio(대시보드)에서 고치면 로그인 정보가 없다. 그때는 edited_by 칸에 적힌 값을 믿는다.
    new.edited_by := coalesce(actor, new.edited_by);
  end if;

  if not importing then
    if btrim(coalesce(new.edit_note, '')) = '' then
      raise exception '%: 고친 이유(edit_note)를 적어 주세요', label;
    end if;
    if new.edited_by is null then
      raise exception '%: 누가 고쳤는지 알 수 없습니다. 로그인한 팀원으로 고치거나, Studio 에서는 edited_by 에 본인 팀원 id 를 넣어 주세요', label;
    end if;
    if not exists (select 1 from public.team_members m where m.user_id = new.edited_by and m.is_active) then
      raise exception '%: 팀원 명단(team_members)에 없는 사용자입니다', label;
    end if;
  end if;

  return new;
end;
$$;

-- data_ 표에 붙는다. 모든 변경을 team_change_log 에 남긴다.
-- 팀원은 이력 표에 직접 쓸 수 없으므로 security definer 로 소유자 권한을 빌린다.
create function public.trg_log_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  key_col text  := tg_argv[0];
  o       jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n       jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  cur     jsonb := coalesce(n, o);
begin
  insert into public.team_change_log (changed_by, table_name, item_key, action, version, edit_note, old_row, new_row)
  values (
    auth.uid(),
    tg_table_name,
    cur ->> key_col,
    lower(tg_op)::public.opt_change_action,
    (cur ->> 'version')::integer,
    -- 게시 상태만 바꾸면 지난번 이유가 그대로 남아 있다. 엉뚱한 이유가 붙지 않게 비운다.
    case when tg_op = 'UPDATE' and (n ->> 'edit_note') is not distinct from (o ->> 'edit_note')
         then null else cur ->> 'edit_note' end,
    o,
    n
  );
  return null;
end;
$$;

-- 기록용 표(team_change_log, team_reviews)에 붙는다. 수정·삭제를 막는다.
create function public.trg_block_edit()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception '%: 기록은 고치거나 지울 수 없습니다. 잘못 남겼다면 새 기록으로 바로잡으세요', tg_table_name;
end;
$$;

create function public.is_strictly_increasing(v integer[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(v[i] < v[i + 1]), true)
  from generate_subscripts(v, 1) as i
  where i < array_upper(v, 1);
$$;

comment on function public.trg_track_version()            is '트리거 전용. 내용이 바뀌면 version 을 올리고 작성자·이유를 확인한다';
comment on function public.trg_log_change()               is '트리거 전용. 모든 변경을 team_change_log 에 남긴다';
comment on function public.trg_block_edit()               is '트리거 전용. 기록 표의 수정·삭제를 막는다';
comment on function public.is_strictly_increasing(integer[]) is '배열 값이 앞에서 뒤로 갈수록 커지는가 (중위소득표 검사용)';


-- ── 3. 앱 데이터 (data_) ─────────────────────────────────────────────

-- 3-1. 소득 구간 ──────────────────────────────────────────────────────

create table public.data_income_brackets (
  bracket smallint not null,
  label   text not null,

  primary key (bracket),
  constraint "구간_번호" check (bracket > 0),
  constraint "이름_필수" check (btrim(label) <> '')
);

comment on table  public.data_income_brackets         is '1층 질문의 소득 선택지. 한 행 = 선택지 하나. 원본 data/income-brackets.json. 검수 대상이 아니라 관리 칸이 없다';
comment on column public.data_income_brackets.bracket is '구간 번호 (1부터). 정책의 소득 하한·상한이 이 번호를 가리킨다';
comment on column public.data_income_brackets.label   is '화면에 보이는 이름 (예: 월 150~200만원)';

create trigger log_change after insert or update or delete on public.data_income_brackets
  for each row execute function public.trg_log_change('bracket');


-- 3-2. 기준 중위소득표 ────────────────────────────────────────────────
-- 금액을 배열 한 칸에 담는다. 숫자 하나만 고쳐도 그해 표 전체의 version 이 올라
-- 다시 검수를 받게 하려는 것이다. 2027년 값이 2026년 칸에 들어가 있던 사고
-- (docs/기획/2026-08-23-정책데이터-검증기록.md)를 다시 막는다.

create table public.data_income_thresholds (
  effective_year        smallint not null,
  is_active             boolean not null default false,
  monthly_median_income integer[] not null,
  source_label          text not null,
  source_url            text not null,
  note                  text not null default '',

  version               integer not null default 1,
  edited_at             timestamptz not null default now(),
  edited_by             uuid,
  edit_note             text not null default '',

  primary key (effective_year),
  constraint "적용_연도" check (effective_year between 2020 and 2100),
  constraint "금액_배열" check (cardinality(monthly_median_income) between 1 and 10
                                and array_position(monthly_median_income, null) is null
                                and 0 < all (monthly_median_income)
                                and public.is_strictly_increasing(monthly_median_income)),
  constraint "출처_필수" check (btrim(source_label) <> '' and source_url ~ '^https?://'),
  constraint "작성자"    foreign key (edited_by) references public.team_members (user_id)
);

create unique index "사용중인_표는_하나" on public.data_income_thresholds (is_active) where is_active;

comment on table  public.data_income_thresholds                       is '기준 중위소득표. 한 행 = 한 해의 표. 원본 data/income-thresholds.json';
comment on column public.data_income_thresholds.effective_year        is '적용 연도';
comment on column public.data_income_thresholds.is_active             is '앱이 쓰는 표인가. true 는 한 해만 가능';
comment on column public.data_income_thresholds.monthly_median_income is '월 금액(원) 배열. n번째 값 = n인 가구. 가구원 수가 늘수록 커져야 한다';
comment on column public.data_income_thresholds.source_label          is '출처 이름 (예: 보건복지부 2026년도 기준 중위소득)';
comment on column public.data_income_thresholds.source_url            is '출처 원문 주소';
comment on column public.data_income_thresholds.note                  is '계산 방법·재확인할 점 등 메모';
comment on column public.data_income_thresholds.version               is '[관리] 내용 버전. 내용을 고치면 1씩 오르고 다시 검수가 필요해진다';
comment on column public.data_income_thresholds.edited_at             is '[관리] 마지막으로 내용을 고친 시각';
comment on column public.data_income_thresholds.edited_by             is '[관리] 현재 버전을 쓴 팀원. 이 사람은 이 버전을 검수할 수 없다';
comment on column public.data_income_thresholds.edit_note             is '[관리] 고친 이유. 내용을 고칠 때마다 새로 적어야 한다';

create trigger track_version before insert or update on public.data_income_thresholds
  for each row execute function public.trg_track_version('effective_year');
create trigger log_change after insert or update or delete on public.data_income_thresholds
  for each row execute function public.trg_log_change('effective_year');


-- 3-3. 정책 ───────────────────────────────────────────────────────────
-- 칸 뜻의 원본은 apps/web/lib/types.ts 의 PolicyMeta 주석이다.
-- 새 정책을 넣으면 lib/policy-rules.ts 에도 판정 규칙을 추가해야 한다 —
-- DB 는 코드를 검사할 수 없으므로 JSON 을 뽑은 뒤 npm test 가 이것을 잡는다.

create table public.data_policies (
  -- 식별
  id                           text not null,
  status                       public.opt_publish_status not null default 'draft',
  sort_order                   integer not null default 1000,
  -- 기본 정보
  name                         text not null,
  agency                       text not null,
  region_scope                 text not null,
  effective_year               smallint not null,
  -- 신청 기간
  application_start            date not null,
  application_end              date,
  -- 지원 내용
  benefit_type                 public.opt_benefit_type not null,
  benefit_summary              text not null,
  monthly_cap                  integer,
  max_months                   integer,
  lump_sum_cap                 integer,
  lump_sum_basis               public.opt_lump_sum_basis,
  -- 2층 판정
  required_inputs              public.opt_eligibility_input[] not null,
  exclusive_group              text[] not null default '{}',
  -- 1층 판정
  discovery_age_min            smallint,
  discovery_age_max            smallint,
  discovery_regions            text[] not null,
  discovery_statuses           public.opt_discovery_status[],
  discovery_income_bracket_min smallint,
  discovery_income_bracket_max smallint,
  discovery_housing_types      public.opt_housing_type[],
  -- 출처·연결
  source_url                   text not null,
  apply_url                    text not null,
  youth_policy_no              text,
  gov24_service_id             text,
  -- 메모
  notes                        text not null default '',
  -- 관리
  version                      integer not null default 1,
  edited_at                    timestamptz not null default now(),
  edited_by                    uuid,
  edit_note                    text not null default '',

  primary key (id),
  constraint "id_형식"              check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint "글자칸_비우기_금지"     check (btrim(name) <> '' and btrim(agency) <> ''
                                         and btrim(region_scope) <> '' and btrim(benefit_summary) <> ''),
  constraint "적용_연도"            check (effective_year between 2020 and 2100),
  constraint "신청_종료는_시작_이후"  check (application_end is null or application_end >= application_start),
  constraint "금액과_개월은_양수"     check (coalesce(monthly_cap, 1) > 0 and coalesce(max_months, 1) > 0
                                         and coalesce(lump_sum_cap, 1) > 0),
  -- 지원 형태마다 필요한 금액 칸이 다르다. 엉뚱한 칸에 금액이 들어가면 2층 계산이 그 값을 읽는다.
  constraint "지원_형태별_금액칸"     check (case benefit_type
                                           when 'lump_sum' then lump_sum_cap is not null and lump_sum_basis is not null
                                                                and monthly_cap is null and max_months is null
                                           else monthly_cap is not null and lump_sum_cap is null and lump_sum_basis is null
                                         end),
  constraint "필요_입력_필수"         check (cardinality(required_inputs) > 0 and array_position(required_inputs, null) is null),
  constraint "중복_그룹_형식"         check (array_position(exclusive_group, null) is null
                                         and array_to_string(exclusive_group, ',')
                                             ~ '^([a-z0-9]+(-[a-z0-9]+)*(,[a-z0-9]+(-[a-z0-9]+)*)*)?$'),
  constraint "나이_범위"             check (coalesce(discovery_age_min, 0) >= 0 and coalesce(discovery_age_max, 0) >= 0
                                         and (discovery_age_min is null or discovery_age_max is null
                                              or discovery_age_min <= discovery_age_max)),
  constraint "지역_필수"             check (cardinality(discovery_regions) > 0 and array_position(discovery_regions, null) is null),
  -- null 은 '공고 확인 전', 빈 목록은 뜻이 없다.
  constraint "상태_빈목록_금지"       check (discovery_statuses is null
                                         or (cardinality(discovery_statuses) > 0
                                             and array_position(discovery_statuses, null) is null)),
  -- 하한만 있고 상한이 없으면 밴드가 반쪽이라 판정이 이상해진다.
  constraint "소득_하한은_상한과_함께" check (discovery_income_bracket_min is null
                                         or (discovery_income_bracket_max is not null
                                             and discovery_income_bracket_min <= discovery_income_bracket_max)),
  -- null 은 '따지지 않음', 빈 목록은 뜻이 없다.
  constraint "주거형태_빈목록_금지"   check (discovery_housing_types is null
                                         or (cardinality(discovery_housing_types) > 0
                                             and array_position(discovery_housing_types, null) is null)),
  constraint "URL_형식"             check (source_url ~ '^https?://' and apply_url ~ '^https?://'),
  constraint "온통청년_번호_형식"     check (youth_policy_no ~ '^\d{20}$'),
  constraint "온통청년_번호_중복"     unique (youth_policy_no),
  constraint "보조금24_번호_중복"     unique (gov24_service_id),
  constraint "소득_하한_구간"         foreign key (discovery_income_bracket_min) references public.data_income_brackets (bracket),
  constraint "소득_상한_구간"         foreign key (discovery_income_bracket_max) references public.data_income_brackets (bracket),
  constraint "작성자"               foreign key (edited_by) references public.team_members (user_id)
);

create index data_policies_list_idx on public.data_policies (status, sort_order);

comment on table  public.data_policies                              is '현금성 주거 지원 정책. 한 행 = 정책 하나. 원본 data/policies.json';
comment on column public.data_policies.id                           is '정책 id. 소문자·숫자·하이픈 (예: iksan-youth-rent-support). 한 번 정하면 바꿀 수 없다';
comment on column public.data_policies.status                       is 'draft = 작성 중(앱에 안 나감) / published = 앱에 나감 / archived = 내림. 지우지 말고 archived 로';
comment on column public.data_policies.sort_order                   is '앱 목록 순서. 작은 값이 먼저';
comment on column public.data_policies.name                         is '정책 이름';
comment on column public.data_policies.agency                       is '주관 기관';
comment on column public.data_policies.region_scope                 is '대상 지역 (예: 전국 / 전북특별자치도 / 전북특별자치도 익산시)';
comment on column public.data_policies.effective_year               is '적용 연도';
comment on column public.data_policies.application_start            is '신청 시작일';
comment on column public.data_policies.application_end              is '신청 마감일. 비어 있으면 상시';
comment on column public.data_policies.benefit_type                 is 'rent_capped_monthly = 실제 월세 범위 내 월 상한 / flat_monthly = 월 정액 / lump_sum = 일시금';
comment on column public.data_policies.benefit_summary              is '화면에 보이는 지원 내용 요약 (공고 문구 그대로)';
comment on column public.data_policies.monthly_cap                  is '월 상한액(원). 월 지원형만';
comment on column public.data_policies.max_months                   is '최대 지원 개월 수. 비어 있으면 상한 없음. 월 지원형만';
comment on column public.data_policies.lump_sum_cap                 is '일시금 상한액(원). lump_sum 만';
comment on column public.data_policies.lump_sum_basis               is '일시금 계산 기준. oneTimeMoveCost = 입력한 이사비·중개보수 / notCalculable = 계산하지 않음';
comment on column public.data_policies.required_inputs              is '2층에서 물어볼 항목 (lib/types.ts EligibilityProfile 의 키)';
comment on column public.data_policies.exclusive_group              is '중복 수급 불가 그룹. 같은 그룹끼리는 큰 금액 하나만 합산';
comment on column public.data_policies.discovery_age_min            is '1층: 최소 나이(만). 비어 있으면 나이 제한 없음';
comment on column public.data_policies.discovery_age_max            is '1층: 최대 나이(만). 비어 있으면 나이 제한 없음';
comment on column public.data_policies.discovery_regions            is '1층: 대상 지역 (lib/region.ts 선택지와 같은 말)';
comment on column public.data_policies.discovery_statuses           is '1층: 대상 상태 (대학생·재직·구직). 비어 있으면 공고 확인 전 → 확인 필요';
comment on column public.data_policies.discovery_income_bracket_min is '1층: 소득 구간 하한. 비어 있으면 하한 없음';
comment on column public.data_policies.discovery_income_bracket_max is '1층: 소득 구간 상한. 비어 있으면 확인 전이거나 1층에서 판정 불가 → 확인 필요';
comment on column public.data_policies.discovery_housing_types      is '1층: 대상 주거 형태 (월세·연세·전세·그 외). 비어 있으면 따지지 않음';
comment on column public.data_policies.source_url                   is '공고 원문 주소. 검수할 때 이것과 대조한다';
comment on column public.data_policies.apply_url                    is '공식 신청 페이지 주소';
comment on column public.data_policies.youth_policy_no              is '온통청년 정책번호(20자리). 화면엔 안 나가지만 발굴 스크립트가 쓴다 — 지우지 말 것';
comment on column public.data_policies.gov24_service_id             is '보조금24 서비스 id. 신선도 감지가 쓴다';
comment on column public.data_policies.notes                        is '공고 확인 내용·판정하지 않는 조건 등 메모';
comment on column public.data_policies.version                      is '[관리] 내용 버전. 내용을 고치면 1씩 오르고 다시 검수가 필요해진다';
comment on column public.data_policies.edited_at                    is '[관리] 마지막으로 내용을 고친 시각';
comment on column public.data_policies.edited_by                    is '[관리] 현재 버전을 쓴 팀원. 이 사람은 이 버전을 검수할 수 없다';
comment on column public.data_policies.edit_note                    is '[관리] 고친 이유. 내용을 고칠 때마다 새로 적어야 한다';

create trigger track_version before insert or update on public.data_policies
  for each row execute function public.trg_track_version('id');
create trigger log_change after insert or update or delete on public.data_policies
  for each row execute function public.trg_log_change('id');


-- 3-4. 대출·보증 상품 ─────────────────────────────────────────────────
-- 결과 화면에 안내만 한다. 현금 지원이 아니므로 최대 지원 가능액에 더하지 않는다.

create table public.data_loan_products (
  -- 식별
  id             text not null,
  status         public.opt_publish_status not null default 'draft',
  sort_order     integer not null default 1000,
  -- 내용
  name           text not null,
  agency         text not null,
  region_scope   text not null,
  effective_year smallint not null,
  product_type   public.opt_product_type not null,
  summary        text not null,
  source_url     text not null,
  apply_url      text not null,
  notes          text not null default '',
  -- 관리
  version        integer not null default 1,
  edited_at      timestamptz not null default now(),
  edited_by      uuid,
  edit_note      text not null default '',

  primary key (id),
  constraint "id_형식"          check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint "글자칸_비우기_금지" check (btrim(name) <> '' and btrim(agency) <> ''
                                     and btrim(region_scope) <> '' and btrim(summary) <> ''),
  constraint "적용_연도"        check (effective_year between 2020 and 2100),
  constraint "URL_형식"         check (source_url ~ '^https?://' and apply_url ~ '^https?://'),
  constraint "작성자"           foreign key (edited_by) references public.team_members (user_id)
);

comment on table  public.data_loan_products                is '결과 화면에 안내하는 대출·보증 상품. 한 행 = 상품 하나. 원본 data/loan-products.json';
comment on column public.data_loan_products.id             is '상품 id. 소문자·숫자·하이픈. 한 번 정하면 바꿀 수 없다';
comment on column public.data_loan_products.status         is 'draft = 작성 중 / published = 앱에 나감 / archived = 내림';
comment on column public.data_loan_products.sort_order     is '앱 목록 순서. 작은 값이 먼저';
comment on column public.data_loan_products.name           is '상품 이름';
comment on column public.data_loan_products.agency         is '주관 기관';
comment on column public.data_loan_products.region_scope   is '대상 지역';
comment on column public.data_loan_products.effective_year is '적용 연도';
comment on column public.data_loan_products.product_type   is 'loan_interest_subsidy = 대출·이자 지원 / guarantee_fee_subsidy = 보증료 지원';
comment on column public.data_loan_products.summary        is '화면에 보이는 요약';
comment on column public.data_loan_products.source_url     is '공고 원문 주소';
comment on column public.data_loan_products.apply_url      is '신청 페이지 주소';
comment on column public.data_loan_products.notes          is '메모';
comment on column public.data_loan_products.version        is '[관리] 내용 버전. 내용을 고치면 1씩 오르고 다시 검수가 필요해진다';
comment on column public.data_loan_products.edited_at      is '[관리] 마지막으로 내용을 고친 시각';
comment on column public.data_loan_products.edited_by      is '[관리] 현재 버전을 쓴 팀원. 이 사람은 이 버전을 검수할 수 없다';
comment on column public.data_loan_products.edit_note      is '[관리] 고친 이유. 내용을 고칠 때마다 새로 적어야 한다';

create trigger track_version before insert or update on public.data_loan_products
  for each row execute function public.trg_track_version('id');
create trigger log_change after insert or update or delete on public.data_loan_products
  for each row execute function public.trg_log_change('id');


-- ── 4. 팀 기록 (team_) ───────────────────────────────────────────────

-- 4-1. 변경 이력 ──────────────────────────────────────────────────────
-- 트리거만 쓴다. changed_by 에 FK 를 걸지 않는 이유: 기록은 대상이 사라져도 남아야 한다.

create table public.team_change_log (
  id         bigint generated always as identity,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  table_name text not null,
  item_key   text not null,
  action     public.opt_change_action not null,
  version    integer,
  edit_note  text,
  old_row    jsonb,
  new_row    jsonb,

  primary key (id)
);

create index team_change_log_item_idx on public.team_change_log (table_name, item_key, changed_at desc);

comment on table  public.team_change_log            is '변경 이력. 한 행 = data_ 표에서 일어난 변경 한 번. 자동으로 쌓이며 고치거나 지울 수 없다';
comment on column public.team_change_log.changed_at is '바뀐 시각';
comment on column public.team_change_log.changed_by is '바꾼 사람. 비어 있으면 Studio·SQL Editor 에서 바뀐 것 (작성자는 new_row 의 edited_by 참고)';
comment on column public.team_change_log.table_name is '바뀐 표';
comment on column public.team_change_log.item_key   is '바뀐 행의 키 (정책 id 등)';
comment on column public.team_change_log.action     is 'insert = 추가 / update = 수정 / delete = 삭제';
comment on column public.team_change_log.version    is '변경 후 버전';
comment on column public.team_change_log.edit_note  is '고친 이유';
comment on column public.team_change_log.old_row    is '바뀌기 전 행 전체';
comment on column public.team_change_log.new_row    is '바뀐 뒤 행 전체';

create trigger block_edit before update or delete on public.team_change_log
  for each row execute function public.trg_block_edit();


-- 4-2. 검수 기록 ──────────────────────────────────────────────────────
-- 한 행 = 누군가 데이터 하나의 특정 버전을 원문과 대조한 1회 기록.
-- 대상은 정책·상품·중위소득표 중 정확히 하나다. 비워 둔 칸은 트리거가 채운다.

create table public.team_reviews (
  id              bigint generated always as identity,
  -- 무엇을
  policy_id       text,
  loan_product_id text,
  income_year     smallint,
  target_version  integer not null,
  -- 결과
  result          public.opt_review_result not null,
  memo            text not null default '',
  source_url      text not null,
  -- 누가·언제
  reviewed_by     uuid,
  reviewed_at     timestamptz not null default now(),
  imported        boolean not null default false,

  primary key (id),
  constraint "대상_정책"       foreign key (policy_id) references public.data_policies (id),
  constraint "대상_상품"       foreign key (loan_product_id) references public.data_loan_products (id),
  constraint "대상_중위소득표" foreign key (income_year) references public.data_income_thresholds (effective_year),
  constraint "검수자"          foreign key (reviewed_by) references public.team_members (user_id),
  constraint "대상은_하나만"    check (num_nonnulls(policy_id, loan_product_id, income_year) = 1),
  constraint "URL_형식"        check (source_url ~ '^https?://'),
  constraint "검수자_필수"      check (imported or reviewed_by is not null)
);

create index team_reviews_policy_idx on public.team_reviews (policy_id, target_version);
create index team_reviews_loan_idx   on public.team_reviews (loan_product_id, target_version);
create index team_reviews_income_idx on public.team_reviews (income_year, target_version);

comment on table  public.team_reviews                 is '검수 기록. 한 행 = 데이터 하나의 특정 버전을 원문과 대조한 1회. 고치거나 지울 수 없다';
comment on column public.team_reviews.policy_id       is '검수한 정책 (셋 중 하나만)';
comment on column public.team_reviews.loan_product_id is '검수한 상품 (셋 중 하나만)';
comment on column public.team_reviews.income_year     is '검수한 중위소득표의 연도 (셋 중 하나만)';
comment on column public.team_reviews.target_version  is '검수한 버전. 비워 두면 현재 버전. 그사이 내용이 바뀌었으면 거부된다';
comment on column public.team_reviews.result          is 'confirmed = 원문과 일치 / needs_fix = 고칠 곳 있음 (memo 에 적기)';
comment on column public.team_reviews.memo            is '확인한 곳·다른 점';
comment on column public.team_reviews.source_url      is '대조한 원문 주소. 비워 두면 대상의 출처 주소';
comment on column public.team_reviews.reviewed_by     is '검수한 팀원. 로그인 상태면 자동. 대상의 현재 버전을 쓴 사람은 안 된다';
comment on column public.team_reviews.reviewed_at     is '검수 시각. 자동으로 기록한 때가 들어간다';
comment on column public.team_reviews.imported        is 'JSON 의 verifiedAt 을 옮긴 옛 기록. 원래 검수자 이름이 없어 reviewed_by 가 비어 있다';

create function public.trg_check_review()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  cur_version integer;
  author      uuid;
  src         text;
begin
  if new.policy_id is not null then
    select t.version, t.edited_by, t.source_url into cur_version, author, src
    from public.data_policies t where t.id = new.policy_id;
  elsif new.loan_product_id is not null then
    select t.version, t.edited_by, t.source_url into cur_version, author, src
    from public.data_loan_products t where t.id = new.loan_product_id;
  else
    select t.version, t.edited_by, t.source_url into cur_version, author, src
    from public.data_income_thresholds t where t.effective_year = new.income_year;
  end if;

  if cur_version is null then
    raise exception '검수 대상을 찾을 수 없습니다';
  end if;

  if new.target_version is null then
    new.target_version := cur_version;
  elsif new.target_version <> cur_version and not new.imported then
    raise exception '검수 대상이 그사이 바뀌었습니다 (현재 %판, 검수하려던 %판). 바뀐 내용을 다시 보고 검수하세요',
      cur_version, new.target_version;
  end if;

  new.source_url := coalesce(new.source_url, src);

  if not new.imported then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    -- 검수 시각은 사람이 적지 않는다. 기록하는 때가 대조한 때다.
    new.reviewed_at := now();

    if not exists (select 1 from public.team_members m where m.user_id = new.reviewed_by and m.is_active) then
      raise exception '팀원만 검수할 수 있습니다';
    end if;
    if author is not null and new.reviewed_by = author then
      raise exception '현재 버전을 쓴 사람은 검수할 수 없습니다 (작성자 ≠ 검수자). 다른 팀원에게 검수를 요청하세요';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.trg_check_review() is '트리거 전용. 검수 대상·버전·검수자를 확인하고 빈 칸을 채운다';

create trigger check_review before insert on public.team_reviews
  for each row execute function public.trg_check_review();
create trigger block_edit before update or delete on public.team_reviews
  for each row execute function public.trg_block_edit();


-- 4-3. 검수 대기 목록 (뷰) ────────────────────────────────────────────
-- 한 행 = 데이터 하나의 현재 버전과 그 버전의 마지막 검수 결과.
-- needs_review 가 true 인 것부터 처리하면 된다.

create view public.team_review_queue
with (security_invoker = true) as
select '정책'::text as kind, t.id as item_key, t.name as title, t.status::text as status, t.version, t.edited_at,
       editor.display_name as edited_by_name,
       r.result as last_result, r.reviewed_at as last_reviewed_at, reviewer.display_name as last_reviewer_name,
       (r.result is distinct from 'confirmed') as needs_review
from public.data_policies t
left join public.team_members editor on editor.user_id = t.edited_by
left join lateral (
  select x.result, x.reviewed_at, x.reviewed_by from public.team_reviews x
  where x.policy_id = t.id and x.target_version = t.version
  order by x.reviewed_at desc, x.id desc limit 1
) r on true
left join public.team_members reviewer on reviewer.user_id = r.reviewed_by
union all
select '상품', t.id, t.name, t.status::text, t.version, t.edited_at, editor.display_name,
       r.result, r.reviewed_at, reviewer.display_name, (r.result is distinct from 'confirmed')
from public.data_loan_products t
left join public.team_members editor on editor.user_id = t.edited_by
left join lateral (
  select x.result, x.reviewed_at, x.reviewed_by from public.team_reviews x
  where x.loan_product_id = t.id and x.target_version = t.version
  order by x.reviewed_at desc, x.id desc limit 1
) r on true
left join public.team_members reviewer on reviewer.user_id = r.reviewed_by
union all
select '중위소득표', t.effective_year::text, t.source_label,
       case when t.is_active then 'published' else 'draft' end, t.version, t.edited_at, editor.display_name,
       r.result, r.reviewed_at, reviewer.display_name, (r.result is distinct from 'confirmed')
from public.data_income_thresholds t
left join public.team_members editor on editor.user_id = t.edited_by
left join lateral (
  select x.result, x.reviewed_at, x.reviewed_by from public.team_reviews x
  where x.income_year = t.effective_year and x.target_version = t.version
  order by x.reviewed_at desc, x.id desc limit 1
) r on true
left join public.team_members reviewer on reviewer.user_id = r.reviewed_by;

comment on view public.team_review_queue is '검수 현황. 한 행 = 데이터 하나의 현재 버전. needs_review 가 true 면 검수가 필요하다';


-- ── 5. 앱용 JSON 내보내기 ────────────────────────────────────────────
-- apps/web/data/*.json 과 같은 모양을 돌려준다. published 만 나간다.
-- verifiedAt = 현재 버전의 마지막 검수가 confirmed 일 때 그 날짜, 아니면 null.

create function public.export_policies()
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by sort_order, id), '[]'::jsonb)
  from (
    select p.sort_order, p.id,
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'agency', p.agency,
        'regionScope', p.region_scope,
        'applicationStart', to_char(p.application_start, 'YYYY-MM-DD'),
        'applicationEnd', to_char(p.application_end, 'YYYY-MM-DD'),
        'benefitType', p.benefit_type,
        'benefitSummary', p.benefit_summary,
        'requiredInputs', to_jsonb(p.required_inputs),
        'exclusiveGroup', to_jsonb(p.exclusive_group),
        'sourceUrl', p.source_url,
        'applyUrl', p.apply_url,
        'youthPolicyNo', p.youth_policy_no,
        'gov24ServiceId', p.gov24_service_id,
        'verifiedAt', (
          select case when r.result = 'confirmed'
                      then to_char(r.reviewed_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') end
          from public.team_reviews r
          where r.policy_id = p.id and r.target_version = p.version
          order by r.reviewed_at desc, r.id desc limit 1
        ),
        'effectiveYear', p.effective_year,
        'notes', p.notes,
        'discovery', jsonb_build_object(
          'ageMin', p.discovery_age_min,
          'ageMax', p.discovery_age_max,
          'regions', to_jsonb(p.discovery_regions),
          'statuses', to_jsonb(p.discovery_statuses),
          'incomeBracketMin', p.discovery_income_bracket_min,
          'incomeBracketMax', p.discovery_income_bracket_max,
          'housingTypes', to_jsonb(p.discovery_housing_types)
        )
      )
      -- 이 넷은 JSON 에서 '값이 없으면 키 자체가 없는' 칸이다 (types.ts 의 ? 표시).
      || jsonb_strip_nulls(jsonb_build_object(
        'monthlyCap', p.monthly_cap,
        'maxMonths', p.max_months,
        'lumpSumCap', p.lump_sum_cap,
        'lumpSumBasis', p.lump_sum_basis
      )) as item
    from public.data_policies p
    where p.status = 'published'
  ) s;
$$;

create function public.export_loan_products()
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by sort_order, id), '[]'::jsonb)
  from (
    select l.sort_order, l.id,
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'agency', l.agency,
        'regionScope', l.region_scope,
        'productType', l.product_type,
        'summary', l.summary,
        'sourceUrl', l.source_url,
        'applyUrl', l.apply_url,
        'verifiedAt', (
          select case when r.result = 'confirmed'
                      then to_char(r.reviewed_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') end
          from public.team_reviews r
          where r.loan_product_id = l.id and r.target_version = l.version
          order by r.reviewed_at desc, r.id desc limit 1
        ),
        'effectiveYear', l.effective_year,
        'notes', l.notes
      ) as item
    from public.data_loan_products l
    where l.status = 'published'
  ) s;
$$;

create function public.export_income_thresholds()
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'effectiveYear', t.effective_year,
    'sourceUrl', t.source_url,
    'sourceLabel', t.source_label,
    'note', t.note,
    'monthlyMedianIncomeByHouseholdSize', (
      select jsonb_object_agg(size::text, amount)
      from unnest(t.monthly_median_income) with ordinality as x(amount, size)
    )
  )
  from public.data_income_thresholds t
  where t.is_active;
$$;

create function public.export_income_brackets()
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('bracket', b.bracket, 'label', b.label) order by b.bracket), '[]'::jsonb)
  from public.data_income_brackets b;
$$;

comment on function public.export_policies()          is 'data/policies.json 과 같은 모양으로 내보낸다';
comment on function public.export_loan_products()     is 'data/loan-products.json 과 같은 모양으로 내보낸다';
comment on function public.export_income_thresholds() is 'data/income-thresholds.json 과 같은 모양으로 내보낸다';
comment on function public.export_income_brackets()   is 'data/income-brackets.json 과 같은 모양으로 내보낸다';

revoke execute on function public.export_policies(), public.export_loan_products(),
                           public.export_income_thresholds(), public.export_income_brackets()
  from public, anon;
grant execute on function public.export_policies(), public.export_loan_products(),
                          public.export_income_thresholds(), public.export_income_brackets()
  to authenticated, service_role;


-- ── 6. 접근 권한 (RLS) ───────────────────────────────────────────────
-- 사용자 화면은 DB 를 읽지 않으므로 익명(anon)에게는 아무것도 열지 않는다.
-- 팀원만 읽고 쓴다. 삭제 규칙은 두지 않는다 — 내리려면 status 를 archived 로.

alter table public.team_members           enable row level security;
alter table public.team_change_log        enable row level security;
alter table public.team_reviews           enable row level security;
alter table public.data_income_brackets   enable row level security;
alter table public.data_income_thresholds enable row level security;
alter table public.data_policies          enable row level security;
alter table public.data_loan_products     enable row level security;

revoke all on public.team_members, public.team_change_log, public.team_reviews, public.team_review_queue,
              public.data_income_brackets, public.data_income_thresholds,
              public.data_policies, public.data_loan_products
  from anon, authenticated;

grant select                 on public.team_change_log, public.team_review_queue          to authenticated;
grant select, insert         on public.team_reviews                                       to authenticated;
grant select, insert, update on public.team_members,
                                public.data_income_brackets, public.data_income_thresholds,
                                public.data_policies, public.data_loan_products            to authenticated;

create policy "읽기: 팀원"  on public.team_members for select to authenticated using ((select public.is_team_member()));
create policy "추가: admin" on public.team_members for insert to authenticated with check ((select public.is_team_admin()));
create policy "수정: admin" on public.team_members for update to authenticated using ((select public.is_team_admin())) with check ((select public.is_team_admin()));

create policy "읽기: 팀원" on public.team_change_log for select to authenticated using ((select public.is_team_member()));

create policy "읽기: 팀원" on public.team_reviews for select to authenticated using ((select public.is_team_member()));
-- 옛 기록 이관(imported)은 seed 만 할 수 있다. 팀원이 검수자 없는 기록을 만들면 안 된다.
create policy "추가: 팀원" on public.team_reviews for insert to authenticated with check ((select public.is_team_member()) and not imported);

create policy "읽기: 팀원" on public.data_income_brackets for select to authenticated using ((select public.is_team_member()));
create policy "추가: 팀원" on public.data_income_brackets for insert to authenticated with check ((select public.is_team_member()));
create policy "수정: 팀원" on public.data_income_brackets for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));

create policy "읽기: 팀원" on public.data_income_thresholds for select to authenticated using ((select public.is_team_member()));
create policy "추가: 팀원" on public.data_income_thresholds for insert to authenticated with check ((select public.is_team_member()));
create policy "수정: 팀원" on public.data_income_thresholds for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));

create policy "읽기: 팀원" on public.data_policies for select to authenticated using ((select public.is_team_member()));
create policy "추가: 팀원" on public.data_policies for insert to authenticated with check ((select public.is_team_member()));
create policy "수정: 팀원" on public.data_policies for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));

create policy "읽기: 팀원" on public.data_loan_products for select to authenticated using ((select public.is_team_member()));
create policy "추가: 팀원" on public.data_loan_products for insert to authenticated with check ((select public.is_team_member()));
create policy "수정: 팀원" on public.data_loan_products for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));
