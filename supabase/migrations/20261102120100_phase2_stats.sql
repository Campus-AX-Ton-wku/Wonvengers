-- ════════════════════════════════════════════════════════════════════
-- 2단계 — 이용 통계 (익명)
--
-- 만드는 것
--   stats_daily      일별 집계 (뷰)
--   stats_events     이용 이벤트
--   opt_event_name   이벤트 종류 선택지
--
-- 어떤 정책이 많이 열리고, 공식 신청 링크까지 몇 번 닿는지를 센다. 제품의 성공
-- 기준이 "공식 신청 페이지까지 닿는 것"(PRODUCT.md)이라 apply_click 이 가장 중요하다.
--
-- 사용자 답변(나이·지역·소득·주거 형태)을 담을 칸 자체가 없다. 칸이 없으면 실수로라도
-- 보낼 수 없다. 로그인한 사용자라도 계정 id 를 남기지 않는다.
--
-- 이 표에는 IP 를 남기지 않지만 Supabase API 로그에는 남는다. 화면에 익명 통계 수집
-- 고지가 필요하다.
-- ════════════════════════════════════════════════════════════════════

create type public.opt_event_name as enum ('page_view', 'policy_open', 'source_click', 'apply_click', 'calculate_done');

comment on type public.opt_event_name is '이벤트 종류 — page_view: 화면 진입 / policy_open: 정책 열기 / source_click: 공고 원문 클릭 / apply_click: 공식 신청 링크 클릭 / calculate_done: 2층 결과 도달';

create table public.stats_events (
  id          bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  event_name  public.opt_event_name not null,
  page_path   text,
  policy_id   text,
  session_id  uuid,

  primary key (id),
  -- 경로만 받는다. ?·# 뒤에는 답변이 실릴 수 있어 아예 거부한다.
  constraint "경로_형식"           check (page_path ~ '^/[A-Za-z0-9/_-]*$' and length(page_path) <= 200),
  constraint "화면진입은_경로_필수"  check (event_name <> 'page_view' or page_path is not null),
  constraint "정책_이벤트는_정책_필수" check ((event_name in ('policy_open', 'source_click', 'apply_click')) = (policy_id is not null)),
  constraint "대상_정책"           foreign key (policy_id) references public.data_policies (id)
);

create index stats_events_time_idx   on public.stats_events (occurred_at);
create index stats_events_policy_idx on public.stats_events (policy_id, event_name, occurred_at);

comment on table  public.stats_events             is '익명 이용 이벤트. 한 행 = 이벤트 하나. 누구나 쓰기만 할 수 있고 팀원만 읽는다';
comment on column public.stats_events.occurred_at is '일어난 시각';
comment on column public.stats_events.event_name  is 'page_view = 화면 진입 / policy_open = 정책 열기 / source_click = 공고 원문 클릭 / apply_click = 공식 신청 링크 클릭 / calculate_done = 2층 결과 도달';
comment on column public.stats_events.page_path   is '화면 경로 (예: /find). ?·# 는 받지 않는다';
comment on column public.stats_events.policy_id   is '정책 이벤트의 대상 정책';
comment on column public.stats_events.session_id  is '탭을 열 때 만든 임의 값. 탭을 닫으면 사라지고 계정과 묶이지 않는다. 한 번 방문의 흐름을 볼 때만 쓴다';

create view public.stats_daily
with (security_invoker = true) as
select (e.occurred_at at time zone 'Asia/Seoul')::date as day,
       e.event_name,
       e.policy_id,
       p.name                       as policy_name,
       count(*)                     as events,
       count(distinct e.session_id) as sessions
from public.stats_events e
left join public.data_policies p on p.id = e.policy_id
group by 1, 2, 3, 4;

comment on view public.stats_daily is '일별 집계. 한 행 = 날짜(한국 시간) × 이벤트 × 정책';


-- ── 접근 권한 (RLS) ──────────────────────────────────────────────────

alter table public.stats_events enable row level security;

revoke all on public.stats_events, public.stats_daily from anon, authenticated;
grant insert on public.stats_events                    to anon, authenticated;
grant select on public.stats_events, public.stats_daily to authenticated;

-- 값 검사는 위 제약이 맡는다.
create policy "추가: 누구나" on public.stats_events for insert to anon, authenticated with check (true);
create policy "읽기: 팀원"  on public.stats_events for select to authenticated using ((select public.is_team_member()));
