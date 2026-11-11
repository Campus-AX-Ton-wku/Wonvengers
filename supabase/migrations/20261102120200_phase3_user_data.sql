-- ════════════════════════════════════════════════════════════════════
-- 3단계 — 사용자 계정·저장 (선택 가입)
--
-- 만드는 것
--   user_answers        저장한 1층 답변
--   user_calculations   저장한 2층 계산
--   user_consents       개인정보 수집 동의
--
-- ⚠️ 이 단계는 제품의 약속을 바꾼다. PRD F0-13·F2-10 과 PRODUCT.md 는
-- "답변은 브라우저에만 둔다. 서버로 보내지 않는다"를 원칙으로 적고 있다.
-- 화면이 이 표를 쓰기 시작하기 전에 다음이 먼저 있어야 한다.
--   - 개인정보 처리방침 문서와 그 버전 (user_consents.consent_version)
--   - 로그인하지 않은 사람은 지금처럼 localStorage 만 쓰는 흐름
--   - PRD·PRODUCT.md 의 원칙 문구 수정
-- 표를 만드는 것만으로는 아무것도 수집되지 않는다.
--
-- 지키는 규칙
--   - 동의가 없으면 저장할 수 없다
--   - 동의를 철회하면 저장한 답변·계산이 즉시 지워진다
--   - 계정을 지우면 전부 함께 지워진다
--   - 본인 행만 읽고 쓴다. 팀원도 사용자 데이터를 볼 수 없다
-- ════════════════════════════════════════════════════════════════════


-- ── 1. 동의 ──────────────────────────────────────────────────────────

create table public.user_consents (
  user_id         uuid not null,
  consent_version text not null,
  agreed_at       timestamptz not null default now(),
  withdrawn_at    timestamptz,

  primary key (user_id),
  constraint "로그인_계정"   foreign key (user_id) references auth.users (id) on delete cascade,
  constraint "처리방침_버전" check (btrim(consent_version) <> '')
);

comment on table  public.user_consents                 is '개인정보 수집 동의. 한 행 = 사용자 한 명의 현재 동의 상태. 처리방침이 바뀌면 다시 동의받아 갱신한다';
comment on column public.user_consents.user_id         is 'Supabase 로그인 계정 id';
comment on column public.user_consents.consent_version is '동의한 처리방침 버전 (예: 2026-11-v1)';
comment on column public.user_consents.agreed_at       is '동의한 시각';
comment on column public.user_consents.withdrawn_at    is '철회한 시각. 값이 들어가는 순간 저장 데이터가 지워진다';

create function public.has_active_consent()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_consents c where c.user_id = auth.uid() and c.withdrawn_at is null);
$$;

comment on function public.has_active_consent() is '지금 로그인한 사람이 동의한 상태인가 (권한 규칙에서 쓴다)';


-- ── 2. 저장한 1층 답변 ───────────────────────────────────────────────
-- 모양은 앱 타입(lib/types.ts DiscoveryAnswers)이 정하고 바뀔 수 있어 jsonb 로 둔다.
-- schema_version 으로 옛 모양을 알아보고 앱이 옮긴다.

create table public.user_answers (
  user_id        uuid not null,
  saved_at       timestamptz not null default now(),
  schema_version smallint not null default 1,
  answers        jsonb not null,

  primary key (user_id),
  constraint "로그인_계정" foreign key (user_id) references auth.users (id) on delete cascade,
  constraint "형식_버전"   check (schema_version > 0),
  constraint "답변_형식"   check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 4096)
);

comment on table  public.user_answers                is '저장한 1층 답변. 한 행 = 사용자 한 명의 마지막 답변';
comment on column public.user_answers.user_id        is 'Supabase 로그인 계정 id';
comment on column public.user_answers.saved_at       is '저장한 시각';
comment on column public.user_answers.schema_version is '답변 모양의 버전. 앱 타입이 바뀌면 올린다';
comment on column public.user_answers.answers        is '답변 (DiscoveryAnswers). 4KB 이하';


-- ── 3. 저장한 2층 계산 ───────────────────────────────────────────────
-- 금액 둘은 목록에 보여 주려고 따로 뺀다. 정책이 그 뒤 바뀌었을 수 있으므로
-- 화면에서는 computed_at 과 함께 "다시 계산하기"를 둔다.

create table public.user_calculations (
  id                 uuid not null default gen_random_uuid(),
  user_id            uuid not null,
  computed_at        timestamptz not null default now(),
  title              text not null default '',
  max_support_amount integer not null,
  final_housing_cost integer not null,
  schema_version     smallint not null default 1,
  listing            jsonb not null,
  profile            jsonb not null,

  primary key (id),
  constraint "로그인_계정" foreign key (user_id) references auth.users (id) on delete cascade,
  constraint "제목_길이"   check (length(title) <= 50),
  constraint "금액은_0이상" check (max_support_amount >= 0 and final_housing_cost >= 0),
  constraint "형식_버전"   check (schema_version > 0),
  constraint "입력_형식"   check (jsonb_typeof(listing) = 'object' and octet_length(listing::text) <= 4096
                               and jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 8192)
);

create index user_calculations_user_idx on public.user_calculations (user_id, computed_at desc);

comment on table  public.user_calculations                    is '저장한 2층 계산. 한 행 = 사용자가 저장한 계산 한 건 (매물 하나를 비교해 본 기록)';
comment on column public.user_calculations.user_id            is 'Supabase 로그인 계정 id';
comment on column public.user_calculations.computed_at        is '계산한 시각. 정책이 그 뒤 바뀌었을 수 있다';
comment on column public.user_calculations.title              is '사용자가 붙인 이름 (예: 신동 원룸). 50자 이하';
comment on column public.user_calculations.max_support_amount is '최대 지원 가능액(원)';
comment on column public.user_calculations.final_housing_cost is '최종 예상 주거비(원)';
comment on column public.user_calculations.schema_version     is '입력 모양의 버전. 앱 타입이 바뀌면 올린다';
comment on column public.user_calculations.listing            is '계약 조건 (ListingInput). 4KB 이하';
comment on column public.user_calculations.profile            is '자격 답변 (EligibilityProfile). 8KB 이하';


-- ── 4. 동의 철회 시 삭제 ─────────────────────────────────────────────

create function public.trg_purge_on_withdraw()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.withdrawn_at is not null and old.withdrawn_at is null then
    delete from public.user_answers      where user_id = new.user_id;
    delete from public.user_calculations where user_id = new.user_id;
  end if;
  return null;
end;
$$;

comment on function public.trg_purge_on_withdraw() is '트리거 전용. 동의를 철회하면 그 사람의 저장 데이터를 지운다';

create trigger purge_on_withdraw after update on public.user_consents
  for each row execute function public.trg_purge_on_withdraw();


-- ── 5. 접근 권한 (RLS) ───────────────────────────────────────────────

alter table public.user_consents     enable row level security;
alter table public.user_answers      enable row level security;
alter table public.user_calculations enable row level security;

revoke all on public.user_consents, public.user_answers, public.user_calculations from anon, authenticated;
grant select, insert, update         on public.user_consents                         to authenticated;
grant select, insert, update, delete on public.user_answers, public.user_calculations to authenticated;

create policy "읽기: 본인" on public.user_consents for select to authenticated using (user_id = (select auth.uid()));
create policy "추가: 본인" on public.user_consents for insert to authenticated with check (user_id = (select auth.uid()));
create policy "수정: 본인" on public.user_consents for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "읽기: 본인"        on public.user_answers for select to authenticated using (user_id = (select auth.uid()));
create policy "추가: 동의한 본인" on public.user_answers for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_active_consent()));
create policy "수정: 동의한 본인" on public.user_answers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.has_active_consent()));
create policy "삭제: 본인"        on public.user_answers for delete to authenticated using (user_id = (select auth.uid()));

create policy "읽기: 본인"        on public.user_calculations for select to authenticated using (user_id = (select auth.uid()));
create policy "추가: 동의한 본인" on public.user_calculations for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_active_consent()));
create policy "수정: 동의한 본인" on public.user_calculations for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.has_active_consent()));
create policy "삭제: 본인"        on public.user_calculations for delete to authenticated using (user_id = (select auth.uid()));
