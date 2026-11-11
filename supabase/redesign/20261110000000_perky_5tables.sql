-- ════════════════════════════════════════════════════════════════════════
-- Perky DB — 익산 원문·검수용 4테이블 (2026-11-11 확정 방식)
--
--   ② policy_raw       정책 원문          (멘토: 정책 원문 테이블)
--   ③ policies         가공 정책          (멘토: 가공된 정책 테이블)
--   ④ agencies         시행처·연락처      (멘토: 기타 정보 테이블)
--   ⑤ policy_checks    확인 기록          (정책 확인일·검수·전화 문의)
--
--   ① 사용자(멘토: 사용자 테이블)는 Supabase 에 두지 않는다. 로그인 사용자의 답은
--      AWS(infra/ 의 DynamoDB UserData 표, 카카오 로그인)가 이미 맡고 있다.
--
-- 확정 방식 (docs/기획/2026-11-11-DB-익산-원문검수-계획.md)
--   - 앱은 지금처럼 apps/web/data 의 정책 JSON 을 읽는다. 이 DB 를 읽지 않는다.
--   - 이 DB 에는 익산 사용자에게 보이는 14건 + 새 후보 2건의 원문과 검수 기록만 넣는다.
--   - DB 값을 JSON 에 덮어쓰지 않는다. 틀린 값은 JSON 을 PR 로 고치고, DB 에도 같은 값을 남긴다.
--   - 그래서 익명(anon) 접근은 하나도 열지 않는다. 로그인한 팀원만 읽고 쓴다.
--
-- 바탕: Perky_DB_summary.docx 의 표 22개를 멘토 조언("필수 4개, 5개 이하,
-- 과도한 조인 금지")에 맞춰 합쳤다 → docs/기획/2026-11-09-DB-재설계-5테이블.md
--
-- 이름 규칙
--   - 정해진 값만 받는 칸은 선택지 타입(opt_)이라 Table Editor 에서 드롭다운으로 고른다.
--   - 규칙을 어기면 한글 규칙 이름이 에러에 나온다. 예: violates check constraint "나이_범위"
--   - null 의 뜻은 칸마다 설명에 적었다. 기본은 "공고 미확인(모름)" 이다 — 추정해서 채우지 않는다.
-- ════════════════════════════════════════════════════════════════════════


-- ── 선택지 타입 ──────────────────────────────────────────────────────────
create type public.opt_status        as enum ('대학생', '재직', '구직');
create type public.opt_housing       as enum ('월세', '연세', '전세', '그 외');
create type public.opt_income_basis  as enum ('세전', '세후', '소득인정액', '건강보험료', '모름');
create type public.opt_kind          as enum ('현금', '대출', '보증료', '임대', '저축');
create type public.opt_purpose       as enum ('주거비 경감', '보증금 안전', '이주·정착', '자산 형성', '주택 공급');
create type public.opt_policy_status as enum ('예정', '운영', '종료', '보류');
create type public.opt_benefit_type  as enum ('rent_capped_monthly', 'flat_monthly', 'lump_sum');
create type public.opt_raw_kind      as enum ('공고문', '온통청년API', '보조금24API', '복지로지자체API', '복지로중앙부처API', 'LH공고API', '기사', '전화');
create type public.opt_agency_level  as enum ('중앙부처', '시도', '시군구', '공공기관');
create type public.opt_contact_kind  as enum ('담당부서', '청년센터', '콜센터', '주민센터', '기타');
create type public.opt_check_method  as enum ('원문대조', '전화문의', 'AI교차', '자동확인');
create type public.opt_check_result  as enum ('일치', '불일치', '확인불가', '질문중', '정상', '링크오류', '내용변경');
create type public.opt_trust_level   as enum ('교차검수', '검수', '미검수', '재확인 필요');

comment on type public.opt_status        is '사용자의 현재 상태 (1층 질문)';
comment on type public.opt_housing       is '계약 형태 (1층 질문)';
comment on type public.opt_income_basis  is '소득 금액의 기준 — 멘토: 세전·세후를 구분해 표시할 것';
comment on type public.opt_kind          is '지원 형태 — 현금만 금액 계산에 들어간다. 대출·보증료·임대·저축은 안내만';
comment on type public.opt_purpose       is '지원 목적 — 목적별로 지역을 비교할 때 쓴다';
comment on type public.opt_policy_status is '운영 상태. 정책은 지우지 않고 종료로 바꾼다';
comment on type public.opt_benefit_type  is '[앱 호환] rent_capped_monthly: 실제 월세 범위 내 월 상한 / flat_monthly: 월 정액 / lump_sum: 일시금';
comment on type public.opt_raw_kind      is '원문을 어디서 가져왔나';
comment on type public.opt_check_method  is '어떻게 확인했나. 자동확인 = 매일 밤 스크립트';
comment on type public.opt_check_result  is '사람 확인: 일치/불일치/확인불가/질문중 · 자동확인: 정상/링크오류/내용변경';
comment on type public.opt_trust_level   is '화면에 보여줄 신뢰도 등급. 확인 기록이 쌓이면 자동으로 바뀐다';


-- ── 공통: 지역 코드 ──────────────────────────────────────────────────────
-- 지역 표를 따로 두지 않는다. 행정구역코드의 앞 2자리가 시도라서 코드만으로
-- 상속이 된다.  '00' = 전국 · '52' = 전북특별자치도 · '52140' = 익산시
create function public.is_region_code(code text) returns boolean
language sql immutable as $$ select code ~ '^(00|[0-9]{2}|[0-9]{5})$' $$;
comment on function public.is_region_code(text) is '지역 코드 형식: 00(전국) · 2자리(시도) · 5자리(시군구)';


-- ════════════════════════════════════════════════════════════════════════
-- ② 정책 원문 — API 응답·공고문·전화 답변을 고치지 않고 그대로 쌓는 곳
-- ════════════════════════════════════════════════════════════════════════
create table public.policy_raw (
  id            bigint generated always as identity primary key,
  kind          public.opt_raw_kind not null,
  external_id   text,
  title         text not null,
  url           text,
  payload       jsonb not null,
  content_hash  text generated always as (md5(payload::text)) stored,
  archive_path  text,
  retrieved_at  timestamptz not null default now(),
  retrieved_by  text not null,
  constraint 원문_주소_형식 check (url is null or url ~ '^https?://'),
  constraint 원문_주소_필수 check (kind = '전화' or url is not null),
  constraint 전화_답변_필수 check (kind <> '전화' or payload ? 'answer'),
  constraint 원문_중복 unique nulls not distinct (kind, external_id, url, content_hash)
);
comment on table  public.policy_raw is '② 정책 원문 — 한 행 = 한 번 가져온 원문. 고치거나 지울 수 없다. 내용이 바뀌면 새 행을 추가한다';
comment on column public.policy_raw.id           is '[식별] 원문 번호. 가공 정책(policies.raw_id)이 이 번호로 원문을 가리킨다';
comment on column public.policy_raw.kind         is '어디서 가져왔나';
comment on column public.policy_raw.external_id  is '외부 시스템 번호 (온통청년 정책번호 20자리, 보조금24 서비스ID, 복지로 servId 등). 공고문·전화는 비움';
comment on column public.policy_raw.title        is '원문 제목 (공고명, API 의 정책명 등)';
comment on column public.policy_raw.url          is '원문 주소. 전화만 비울 수 있다';
comment on column public.policy_raw.payload      is '원문 내용 그대로. API 는 받은 JSON 전체, 공고문은 {"text": 추출한 본문}, 전화는 {"department", "phone", "question", "answer"}';
comment on column public.policy_raw.content_hash is '[자동] 내용 지문. 같은 지문이 이미 있으면 저장되지 않고, 지문이 바뀌면 원문이 바뀐 것';
comment on column public.policy_raw.archive_path is 'Storage 에 올린 원문 사본 위치 (예: source-files/iksan-youth-rent-support/2026-11-10_공고문.pdf)';
comment on column public.policy_raw.retrieved_at is '가져온 시각';
comment on column public.policy_raw.retrieved_by is '가져온 사람 또는 스크립트 이름';


-- ════════════════════════════════════════════════════════════════════════
-- ④ 시행처·연락처 — 기관과 문의 창구. (③보다 먼저 만들어야 ③이 가리킬 수 있다)
-- ════════════════════════════════════════════════════════════════════════
create table public.agencies (
  id              bigint generated always as identity primary key,
  name            text not null,
  level           public.opt_agency_level not null,
  region_code     text not null,
  department      text not null default '',
  contact_kind    public.opt_contact_kind not null default '담당부서',
  phone           text,
  hours           text,
  offers_consult  boolean,
  homepage        text,
  verified_at     date,
  raw_id          bigint references public.policy_raw(id),
  constraint 기관_지역코드 check (public.is_region_code(region_code)),
  constraint 전화번호_형식 check (phone is null or phone ~ '^[0-9]{2,4}-[0-9]{3,4}(-[0-9]{4})?$'),
  constraint 홈페이지_형식 check (homepage is null or homepage ~ '^https?://'),
  constraint 기관_부서_중복 unique (name, department)
);
comment on table  public.agencies is '④ 시행처·연락처 — 한 행 = 기관의 창구 하나 (예: 익산시 청년일자리과). 정책이 시행처와 문의처로 가리킨다';
comment on column public.agencies.id             is '[식별] 번호';
comment on column public.agencies.name           is '기관명 (예: 익산시, 국토교통부)';
comment on column public.agencies.level          is '중앙부처 / 시도 / 시군구 / 공공기관';
comment on column public.agencies.region_code    is '기관이 속한 지역 코드 (중앙부처는 00)';
comment on column public.agencies.department     is '부서·창구 이름. 빈 글자 = 기관 대표 창구';
comment on column public.agencies.contact_kind   is '담당부서 / 청년센터 / 콜센터 / 주민센터';
comment on column public.agencies.phone          is '전화 (예: 063-859-7384, 1599-0001). null = 확인 전';
comment on column public.agencies.hours          is '운영 시간 (예: 평일 09:00~18:00)';
comment on column public.agencies.offers_consult is '상담을 받아 주나. null = 확인 전';
comment on column public.agencies.homepage       is '누리집 주소';
comment on column public.agencies.verified_at    is '연락처를 마지막으로 확인한 날';
comment on column public.agencies.raw_id         is '연락처를 확인한 원문 (공고문 하단, 전화 기록 등)';


-- ════════════════════════════════════════════════════════════════════════
-- ③ 가공 정책 — 원문에서 판정에 필요한 조건값만 뽑은 것. 한 행 = 정책 × 회차
-- ════════════════════════════════════════════════════════════════════════
create table public.policies (
  -- [식별]
  id                     bigint generated always as identity primary key,
  policy_no              text not null,
  year                   smallint not null,
  round_label            text,
  is_current             boolean not null default true,
  -- [원문·기관]
  raw_id                 bigint references public.policy_raw(id),
  agency_id              bigint not null references public.agencies(id),
  contact_id             bigint references public.agencies(id),
  source_url             text not null,
  apply_url              text,
  -- [분류]
  name                   text not null,
  kind                   public.opt_kind not null,
  purpose                public.opt_purpose not null,
  status                 public.opt_policy_status not null default '운영',
  summary                text not null,
  -- [기간]
  valid_from             date,
  valid_until            date,
  apply_start            date,
  apply_end              date,
  -- [대상: 나이]
  age_min                smallint,
  age_max                smallint,
  age_military_extension smallint,
  -- [대상: 지역]
  region_codes           text[] not null,
  region_label           text not null,
  -- [대상: 상태]
  statuses               public.opt_status[],
  -- [대상: 소득·재산]
  income_bracket_min     smallint,
  income_bracket_max     smallint,
  income_median_pct_max  smallint,
  origin_income_median_pct_max smallint,
  income_basis           public.opt_income_basis,
  asset_max              bigint,
  -- [대상: 주거]
  housing_types          public.opt_housing[],
  requires_no_house      boolean,
  deposit_max            bigint,
  rent_max               integer,
  area_max_m2            numeric(5, 1),
  -- [금액]
  benefit_type           public.opt_benefit_type,
  monthly_cap            integer,
  max_months             smallint,
  lump_sum_cap           integer,
  lump_sum_basis         text,
  exclusive_groups       text[],
  required_inputs        text[],
  notes                  text,
  -- [신뢰] 확인 기록(⑤)이 쌓이면 자동으로 채워진다. 손으로 고칠 수 없다
  checked_at             timestamptz,
  check_result           public.opt_check_result,
  trust_level            public.opt_trust_level not null default '미검수',
  -- [관리] 사람이 적는 것은 edited_by · edit_note 둘뿐
  version                integer not null default 1,
  edited_at              timestamptz not null default now(),
  edited_by              text not null,
  edit_note              text not null,

  constraint 정책번호_형식   check (policy_no ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint 연도_범위       check (year between 2020 and 2100),
  constraint 원문주소_형식   check (source_url ~ '^https?://'),
  constraint 신청주소_형식   check (apply_url is null or apply_url ~ '^https?://'),
  constraint 유효기간_순서   check (valid_from is null or valid_until is null or valid_from <= valid_until),
  constraint 신청기간_순서   check (apply_start is null or apply_end is null or apply_start <= apply_end),
  constraint 나이_범위       check (age_min is null or age_max is null or age_min <= age_max),
  constraint 나이_값         check ((age_min is null or age_min between 0 and 120) and (age_max is null or age_max between 0 and 120)),
  constraint 군복무_가산     check (age_military_extension is null or age_military_extension between 0 and 6),
  constraint 지역_필수       check (cardinality(region_codes) > 0),
  constraint 지역코드_형식   check (array_to_string(region_codes, ',') ~ '^(00|[0-9]{2}|[0-9]{5})(,(00|[0-9]{2}|[0-9]{5}))*$'),
  constraint 소득구간_범위   check ((income_bracket_min is null or income_bracket_min between 1 and 5)
                                 and (income_bracket_max is null or income_bracket_max between 1 and 5)
                                 and (income_bracket_min is null or income_bracket_max is null or income_bracket_min <= income_bracket_max)),
  constraint 하한만_금지     check (income_bracket_min is null or income_bracket_max is not null),
  constraint 중위소득_범위   check ((income_median_pct_max is null or income_median_pct_max between 1 and 500)
                                 and (origin_income_median_pct_max is null or origin_income_median_pct_max between 1 and 500)),
  constraint 금액_양수       check ((asset_max is null or asset_max > 0) and (deposit_max is null or deposit_max > 0)
                                 and (rent_max is null or rent_max > 0) and (area_max_m2 is null or area_max_m2 > 0)
                                 and (monthly_cap is null or monthly_cap > 0) and (max_months is null or max_months > 0)
                                 and (lump_sum_cap is null or lump_sum_cap > 0)),
  constraint 현금_지원형태   check (kind <> '현금' or benefit_type is not null),
  constraint 현금만_지원형태 check (kind = '현금' or benefit_type is null),
  constraint 월지원_상한     check (benefit_type is null or benefit_type = 'lump_sum' or monthly_cap is not null),
  constraint 일시금_기준     check (benefit_type is distinct from 'lump_sum' or lump_sum_basis is not null),
  constraint 고친이유_필수   check (btrim(edit_note) <> ''),
  constraint 작성자_필수     check (btrim(edited_by) <> '')
);
create unique index 현재_회차는_하나 on public.policies (policy_no) where is_current;
create unique index 정책_회차_중복   on public.policies (policy_no, year, coalesce(round_label, ''));

comment on table  public.policies is '③ 가공 정책 — 한 행 = 정책 하나의 한 회차. 원문(②)에서 조건값만 뽑아 넣는다. 공고가 바뀌면 덮어쓰지 않고 새 회차 행을 추가한다. 지우지 않고 status 를 종료로 바꾼다';
comment on column public.policies.id                     is '[식별] 행 번호';
comment on column public.policies.policy_no              is '[식별] 정책 번호 — 회차가 바뀌어도 같다. 앱 JSON 의 id 와 같다 (예: iksan-youth-rent-support)';
comment on column public.policies.year                   is '[식별] 사업 연도';
comment on column public.policies.round_label            is '[식별] 회차 (예: 1차, 추가모집). 연 1회 사업은 비움';
comment on column public.policies.is_current             is '[식별] 지금 화면에 쓰는 회차인가. 정책 번호마다 하나만 true';
comment on column public.policies.raw_id                 is '[원문] 이 값들을 뽑아낸 대표 원문 (②)';
comment on column public.policies.agency_id              is '[기관] 시행처 (④)';
comment on column public.policies.contact_id             is '[기관] 문의 창구 (④). 비우면 시행처 대표 창구를 보여준다';
comment on column public.policies.source_url             is '[원문] 화면에 보여줄 공고 원문 주소';
comment on column public.policies.apply_url              is '[원문] 신청 페이지 주소. null = 온라인 신청 없음 또는 확인 전';
comment on column public.policies.name                   is '[분류] 정책명';
comment on column public.policies.kind                   is '[분류] 지원 형태 — 현금만 금액 계산에 들어간다';
comment on column public.policies.purpose                is '[분류] 지원 목적';
comment on column public.policies.status                 is '[분류] 운영 상태';
comment on column public.policies.summary                is '[분류] 한 줄 요약 (예: 월 최대 20만원 × 최대 12개월)';
comment on column public.policies.valid_from             is '[기간] 사업 유효 시작일 (멘토: 정책 유효 기간). null = 확인 전';
comment on column public.policies.valid_until            is '[기간] 사업 유효 종료일. null = 확인 전 또는 계속 사업';
comment on column public.policies.apply_start            is '[기간] 신청 시작일. null = 확인 전';
comment on column public.policies.apply_end              is '[기간] 신청 마감일. null = 상시 또는 예산 소진 시까지';
comment on column public.policies.age_min                is '[나이] 만 나이 하한. age_min·age_max 둘 다 null = 나이 제한 없음 (모름이 아니다)';
comment on column public.policies.age_max                is '[나이] 만 나이 상한';
comment on column public.policies.age_military_extension is '[나이] 군 복무 시 상한을 최대 몇 년 늘려 주나 (멘토 제안). null = 공고에 언급 없음';
comment on column public.policies.region_codes           is '[지역] 신청할 수 있는 지역 코드들. 00 = 전국, 2자리 = 시도 전체, 5자리 = 시군구';
comment on column public.policies.region_label           is '[지역] 화면에 보여줄 지역 이름 (예: 전북특별자치도 익산시)';
comment on column public.policies.statuses               is '[상태] 신청할 수 있는 상태. null = 공고 확인 전 (모름)';
comment on column public.policies.income_bracket_min     is '[소득] 1층 소득 구간 하한. null = 하한 없음';
comment on column public.policies.income_bracket_max     is '[소득] 1층 소득 구간 상한. null = 확인 전 또는 본인 소득으로 판정할 수 없음 (모름). 제한 없음은 5';
comment on column public.policies.income_median_pct_max  is '[소득] 청년(본인) 가구 기준 중위소득 % 상한';
comment on column public.policies.origin_income_median_pct_max is '[소득] 원가구(부모) 기준 중위소득 % 상한';
comment on column public.policies.income_basis           is '[소득] 소득 기준이 세전·세후·소득인정액·건강보험료 중 무엇인가 (멘토: 세전·세후 표기)';
comment on column public.policies.asset_max              is '[재산] 재산 상한 (원)';
comment on column public.policies.housing_types          is '[주거] 인정하는 계약 형태. null = 계약 형태를 따지지 않는 정책 (모름이 아니다)';
comment on column public.policies.requires_no_house      is '[주거] 무주택이어야 하나';
comment on column public.policies.deposit_max            is '[주거] 보증금 상한 (원)';
comment on column public.policies.rent_max               is '[주거] 월 임차료 상한 (원)';
comment on column public.policies.area_max_m2            is '[주거] 주택 면적 상한 (㎡, 예: 60) — 멘토 제안. null = 공고에 없음 또는 확인 전';
comment on column public.policies.benefit_type           is '[금액] 현금 지원의 계산 방식. 현금이 아니면 비움';
comment on column public.policies.monthly_cap            is '[금액] 월 상한 (원)';
comment on column public.policies.max_months             is '[금액] 최대 지급 개월 수';
comment on column public.policies.lump_sum_cap           is '[금액] 일시금 상한 (원)';
comment on column public.policies.lump_sum_basis         is '[금액] 일시금 계산 기준 (앱의 lumpSumBasis)';
comment on column public.policies.exclusive_groups       is '[금액] 같은 묶음끼리는 동시에 받을 수 없다 (예: {youth-rent-cash-support}). 빈 배열 = 묶음 없음';
comment on column public.policies.required_inputs        is '[앱 호환] 2층에서 물어볼 항목 (lib/types.ts EligibilityProfile 의 키)';
comment on column public.policies.notes                  is '확인 못 한 것, 판정하지 않는 조건, 주의사항';
comment on column public.policies.checked_at             is '[신뢰·자동] 정책 확인일 — 마지막으로 일치·정상이 확인된 시각. 화면에 그대로 보여준다';
comment on column public.policies.check_result           is '[신뢰·자동] 마지막 확인 결과';
comment on column public.policies.trust_level            is '[신뢰·자동] 신뢰도 등급. 서로 다른 2명이 일치 확인 = 교차검수, 1명 = 검수';
comment on column public.policies.version                is '[관리·자동] 내용을 고칠 때마다 1씩 오른다. 오르면 검수를 다시 받아야 한다';
comment on column public.policies.edited_at              is '[관리·자동] 마지막으로 고친 시각';
comment on column public.policies.edited_by              is '[관리] 고친 사람 이름. 고칠 때마다 본인 이름으로 바꿔 적는다';
comment on column public.policies.edit_note              is '[관리] 고친 이유와 원문 위치. 고칠 때마다 새로 적어야 저장된다';


-- ════════════════════════════════════════════════════════════════════════
-- ⑤ 확인 기록 — 누가 언제 무엇으로 확인했나 (원문 대조·전화·AI 교차·매일 밤 자동 확인)
-- ════════════════════════════════════════════════════════════════════════
create table public.policy_checks (
  id              bigint generated always as identity primary key,
  policy_id       bigint not null references public.policies(id),
  policy_version  integer not null default 0,
  method          public.opt_check_method not null,
  result          public.opt_check_result not null,
  field_name      text,
  raw_id          bigint references public.policy_raw(id),
  contact_id      bigint references public.agencies(id),
  question        text,
  answer          text,
  memo            text,
  checked_by      text not null,
  checked_at      timestamptz not null default clock_timestamp(),
  constraint 결과_종류     check ((method = '자동확인') = (result in ('정상', '링크오류', '내용변경'))),
  constraint 질문_필수     check (result <> '질문중' or question is not null),
  constraint 전화_답변     check (method <> '전화문의' or result = '질문중' or answer is not null),
  constraint 확인자_필수   check (btrim(checked_by) <> '')
);
create index on public.policy_checks (policy_id, checked_at desc);

comment on table  public.policy_checks is '⑤ 확인 기록 — 한 행 = 확인 한 번. 고치거나 지울 수 없다. 쌓이면 정책의 정책 확인일·신뢰도 등급이 자동으로 바뀐다';
comment on column public.policy_checks.id             is '[식별] 번호';
comment on column public.policy_checks.policy_id      is '확인한 정책 (③의 행 번호)';
comment on column public.policy_checks.policy_version is '[자동] 확인한 때의 정책 버전. 정책을 고치면 옛 버전 확인은 신뢰도에 안 들어간다';
comment on column public.policy_checks.method         is '원문대조 / 전화문의 / AI교차 / 자동확인(매일 밤)';
comment on column public.policy_checks.result         is '확인 결과';
comment on column public.policy_checks.field_name     is '확인한 칸 이름 (예: apply_end). 비우면 정책 전체';
comment on column public.policy_checks.raw_id         is '대조한 원문 (②)';
comment on column public.policy_checks.contact_id     is '물어본 곳 (④). 전화문의·질문중일 때';
comment on column public.policy_checks.question       is '물어본 것 / 아직 풀리지 않은 질문';
comment on column public.policy_checks.answer         is '받은 답';
comment on column public.policy_checks.memo           is '근거 (공고 몇 쪽, GPT·Claude 교차 결과 등)';
comment on column public.policy_checks.checked_by     is '확인한 사람 이름 또는 스크립트 이름 (예: nightly-check)';
comment on column public.policy_checks.checked_at     is '[자동] 확인한 시각';


-- ════════════════════════════════════════════════════════════════════════
-- 규칙 (트리거)
-- ════════════════════════════════════════════════════════════════════════

-- 원문·확인 기록은 고치거나 지울 수 없다 (관리자도)
create function public.trg_insert_only() returns trigger language plpgsql as $$
begin
  raise exception '기록_수정_삭제_금지'
    using hint = tg_table_name || ' 는 고치거나 지울 수 없습니다. 바뀐 내용은 새 행으로 추가하세요.';
end $$;
create trigger insert_only before update or delete on public.policy_raw
  for each row execute function public.trg_insert_only();
create trigger insert_only before update or delete on public.policy_checks
  for each row execute function public.trg_insert_only();

-- 정책은 지우지 않는다
create function public.trg_policies_no_delete() returns trigger language plpgsql as $$
begin
  raise exception '정책_삭제_금지' using hint = 'status 를 종료로, is_current 를 false 로 바꾸세요.';
end $$;
create trigger no_delete before delete on public.policies
  for each row execute function public.trg_policies_no_delete();

-- 새 정책: 버전 1, 신뢰 칸은 비운 채로 시작
create function public.trg_policies_insert() returns trigger language plpgsql as $$
begin
  new.version      := 1;
  new.edited_at    := now();
  new.checked_at   := null;
  new.check_result := null;
  new.trust_level  := '미검수';
  return new;
end $$;
create trigger on_insert before insert on public.policies
  for each row execute function public.trg_policies_insert();

-- 정책을 고치면: 고친 이유 필수 → 버전 +1 → 신뢰도는 미검수로
create function public.trg_policies_update() returns trigger language plpgsql as $$
declare
  관리칸 constant text[] := array['version', 'edited_at', 'edited_by', 'edit_note',
                                  'checked_at', 'check_result', 'trust_level', 'is_current', 'status'];
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
create trigger on_update before update on public.policies
  for each row execute function public.trg_policies_update();

-- 확인 기록을 넣을 때: 버전·시각은 자동, 작성자는 자기 버전을 검수할 수 없다
create function public.trg_checks_before() returns trigger language plpgsql as $$
declare
  p public.policies;
begin
  select * into p from public.policies where id = new.policy_id;
  new.policy_version := p.version;
  new.checked_at     := clock_timestamp();
  if new.method in ('원문대조', '전화문의') and new.result = '일치'
     and btrim(new.checked_by) = btrim(p.edited_by) then
    raise exception '작성자_검수자_같음'
      using hint = '이 버전을 고친 ' || p.edited_by || ' 님이 아닌 다른 팀원이 확인해야 합니다.';
  end if;
  return new;
end $$;
create trigger on_insert before insert on public.policy_checks
  for each row execute function public.trg_checks_before();

-- 확인 기록이 쌓이면: 정책 확인일·마지막 결과·신뢰도 등급을 다시 계산
create function public.trg_checks_sync() returns trigger language plpgsql as $$
declare
  p          public.policies;
  사람_일치  int;
  최근_일치  timestamptz;
  최근_문제  timestamptz;
  확인일     timestamptz;
  등급       public.opt_trust_level;
begin
  select * into p from public.policies where id = new.policy_id;

  select count(distinct btrim(checked_by)), max(checked_at) into 사람_일치, 최근_일치
  from public.policy_checks
  where policy_id = p.id and policy_version = p.version
    and method in ('원문대조', '전화문의') and result = '일치';

  select max(checked_at) into 최근_문제
  from public.policy_checks
  where policy_id = p.id
    and ((method in ('원문대조', '전화문의') and result = '불일치' and policy_version = p.version)
      or (method = '자동확인' and result in ('링크오류', '내용변경')));

  select max(checked_at) into 확인일
  from public.policy_checks
  where policy_id = p.id and result in ('일치', '정상');

  등급 := case
    when 최근_문제 is not null and (최근_일치 is null or 최근_문제 > 최근_일치) then '재확인 필요'
    when 사람_일치 >= 2 then '교차검수'
    when 사람_일치 = 1 then '검수'
    else '미검수'
  end;

  perform set_config('perky.sync', 'on', true);
  update public.policies
     set checked_at = 확인일, check_result = new.result, trust_level = 등급
   where id = p.id;
  perform set_config('perky.sync', 'off', true);
  return null;
end $$;
create trigger on_insert_sync after insert on public.policy_checks
  for each row execute function public.trg_checks_sync();


-- ════════════════════════════════════════════════════════════════════════
-- 사용자 조건 → 정책 고르기 (멘토: "사용자 조건에 맞춰 Select 하는 검증 로직")
--
-- apps/web/lib/filter.ts 와 같은 규칙이다.
--   - 나이·지역·상태·소득·주거 5개를 각각 통과 / 불일치 / 모름 으로 본다
--   - 불일치가 하나라도 있으면 '해당 없음', 모름이 있으면 '확인 필요', 다 통과면 '가능성 있음'
--   - near_miss = 지역 말고 딱 하나만 안 맞음 → 멘토 제안 "한 번 더 확인해 보면 좋은 지원금"
--   - pass_count = "5개 중 몇 개 충족" (멘토 제안)
-- ════════════════════════════════════════════════════════════════════════
create function public.match_policies(
  p_age            int,
  p_region         text,
  p_status         public.opt_status,
  p_income_bracket int,
  p_housing        public.opt_housing,
  p_military       boolean default false,
  p_today          date    default (now() at time zone 'Asia/Seoul')::date
)
returns table (
  policy_no      text,
  name           text,
  kind           public.opt_kind,
  tag            text,
  pass_count     int,
  unknown_count  int,
  fail_count     int,
  fail_fields    text[],
  unknown_fields text[],
  near_miss      boolean,
  apply_state    text,
  apply_end      date,
  valid_until    date,
  summary        text,
  checked_at     timestamptz,
  trust_level    public.opt_trust_level,
  source_url     text,
  contact        text
)
language sql stable as $$
  with judged as (
    select p.*,
      array[
        -- 나이
        case
          when p.age_min is null and p.age_max is null then 'pass'
          when p_age is null then 'unknown'
          when p.age_min is not null and p_age < p.age_min then 'fail'
          when p.age_max is not null
               and p_age > p.age_max + case when coalesce(p_military, false)
                                            then coalesce(p.age_military_extension, 0) else 0 end then 'fail'
          else 'pass' end,
        -- 지역 (코드 앞 2자리가 시도)
        case
          when p_region is null then 'unknown'
          when p.region_codes && array['00', left(p_region, 2), p_region] then 'pass'
          when length(p_region) = 2
               and exists (select 1 from unnest(p.region_codes) rc where left(rc, 2) = p_region) then 'unknown'
          else 'fail' end,
        -- 상태
        case
          when p.statuses is null or p_status is null then 'unknown'
          when p_status = any (p.statuses) then 'pass'
          else 'fail' end,
        -- 소득 구간
        case
          when p.income_bracket_max is null or p_income_bracket is null then 'unknown'
          when p_income_bracket > p.income_bracket_max then 'fail'
          when p.income_bracket_min is not null and p_income_bracket < p.income_bracket_min then 'fail'
          else 'pass' end,
        -- 주거 형태
        case
          when p.housing_types is null then 'pass'
          when p_housing is null then 'unknown'
          when p_housing = any (p.housing_types) then 'pass'
          else 'fail' end
      ] as rs
    from public.policies p
    where p.is_current and p.status <> '보류'
  ),
  counted as (
    select j.*,
      (select count(*) from unnest(j.rs) x where x = 'pass')::int    as n_pass,
      (select count(*) from unnest(j.rs) x where x = 'unknown')::int as n_unknown,
      (select count(*) from unnest(j.rs) x where x = 'fail')::int    as n_fail
    from judged j
  )
  select
    c.policy_no, c.name, c.kind,
    case when c.n_fail > 0 then '해당 없음' when c.n_unknown > 0 then '확인 필요' else '가능성 있음' end,
    c.n_pass, c.n_unknown, c.n_fail,
    array(select l from unnest(c.rs, array['나이', '지역', '상태', '소득', '주거']) t(x, l) where x = 'fail'),
    array(select l from unnest(c.rs, array['나이', '지역', '상태', '소득', '주거']) t(x, l) where x = 'unknown'),
    c.n_fail = 1 and c.rs[2] <> 'fail',   -- 지역이 다른 정책은 '한 번 더 확인' 대상이 아니다
    case
      when c.apply_start is not null and p_today < c.apply_start then '예정'
      when c.apply_end   is not null and p_today > c.apply_end   then '마감'
      when c.apply_end   is null then '상시'
      else '접수중' end,
    c.apply_end, c.valid_until, c.summary, c.checked_at, c.trust_level, c.source_url,
    (select concat_ws(' ', a.name, nullif(a.department, ''), a.phone)
       from public.agencies a where a.id = coalesce(c.contact_id, c.agency_id))
  from counted c
  order by c.n_fail, c.n_unknown, c.kind, c.policy_no;
$$;
comment on function public.match_policies(int, text, public.opt_status, int, public.opt_housing, boolean, date)
  is '사용자 조건으로 정책을 고른다. 결과의 apply_state 가 마감이면 화면에서 "이미 끝난 지원금"으로 따로 보여준다';



-- ════════════════════════════════════════════════════════════════════════
-- 권한 (RLS) — 앱에 로그인 기능이 없으므로 "Supabase 에 로그인한 사람 = 팀원" 이다.
-- 익명(anon) 정책은 하나도 만들지 않는다 → 익명은 아무것도 읽거나 쓸 수 없다.
-- (앱이 이 DB 를 읽지 않고, notes 같은 내부 메모가 밖으로 나가면 안 되기 때문)
-- ════════════════════════════════════════════════════════════════════════
alter table public.policy_raw    enable row level security;
alter table public.agencies      enable row level security;
alter table public.policies      enable row level security;
alter table public.policy_checks enable row level security;

-- 정책·연락처: 팀원이 읽고 넣고 고친다 (지우기는 트리거·권한 모두 없음)
create policy "읽기: 팀원" on public.policies for select to authenticated using (true);
create policy "추가: 팀원" on public.policies for insert to authenticated with check (true);
create policy "수정: 팀원" on public.policies for update to authenticated using (true) with check (true);
create policy "읽기: 팀원" on public.agencies for select to authenticated using (true);
create policy "추가: 팀원" on public.agencies for insert to authenticated with check (true);
create policy "수정: 팀원" on public.agencies for update to authenticated using (true) with check (true);

-- 원문·확인 기록: 팀원이 읽고 넣는다 (수정·삭제는 트리거가 막는다)
create policy "읽기: 팀원" on public.policy_raw    for select to authenticated using (true);
create policy "추가: 팀원" on public.policy_raw    for insert to authenticated with check (true);
create policy "읽기: 팀원" on public.policy_checks for select to authenticated using (true);
create policy "추가: 팀원" on public.policy_checks for insert to authenticated with check (true);

-- 정책 고르기 함수도 팀원만 (멘토 점검 시연은 팀원 계정으로 SQL Editor 에서 돌린다)
revoke execute on function public.match_policies(int, text, public.opt_status, int, public.opt_housing, boolean, date) from public, anon;
grant  execute on function public.match_policies(int, text, public.opt_status, int, public.opt_housing, boolean, date) to authenticated;
