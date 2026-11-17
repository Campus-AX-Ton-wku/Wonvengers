-- supabase/migrations/20261117110000_app_rebuild.sql
-- 정책 데이터가 바뀌면 Vercel 을 다시 빌드한다 (11/17)
--
-- 앱은 빌드할 때 public.app_policies() 를 읽는다(apps/web/scripts/fetch-app-data.mjs). 그래서 DB 를 고쳐도
-- 다시 빌드하기 전에는 앱에 나오지 않았다. 5분마다 app_policies() 결과의 지문(md5)을 보고, 지난번에 빌드를
-- 부른 때와 다르면 Vercel Deploy Hook 을 한 번 부른다.
--   - 앱에 나가는 것만 지문에 들어간다 — 고친 이유만 바꾸거나 '보류' 정책을 고치면 부르지 않는다
--     (공개 정책의 내용 칸은 메모라도 버전 · 검수 상태가 바뀌어 앱의 배지가 달라지므로 부른다)
--   - 몇 분 사이에 여러 칸을 고쳐도 5분 단위로 묶여 한 번만 빌드한다
--   - 부른 요청이 실패하면(2xx 아님 · 시간 초과) 다음 실행에서 다시 부른다
-- 새 정책을 '운영'으로 올리면 → 몇 분 뒤 앱에 반영 → 정각의 알림 Lambda 가 새 정책 알림을 보낸다.
--
-- Deploy Hook 주소는 비밀이라 Vault(이름 vercel_deploy_hook)에만 둔다 — 이 파일 · 저장소에 적지 않는다.
-- 상태 확인: select * from private.app_rebuild_state;  손으로 한 번 돌리기: select private.request_app_rebuild();

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- API(PostgREST)에 드러나지 않는 스키마
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_rebuild_state (
  id              int primary key default 1 check (id = 1),
  last_hash       text,        -- 마지막으로 빌드를 부른 app_policies() 지문
  last_request_id bigint,      -- pg_net 요청 번호 (net._http_response 에서 결과를 본다)
  last_called_at  timestamptz,
  last_status     int,         -- 지난 요청의 HTTP 상태
  last_result     text         -- 마지막으로 무엇을 했는지 ('빌드 요청' · 'Deploy Hook 주소 없음')
);
insert into private.app_rebuild_state (id) values (1);

create or replace function private.request_app_rebuild()
returns text
language plpgsql
set search_path = ''
as $$
declare
  st   private.app_rebuild_state%rowtype;
  resp record;
  h    text;
  hook text;
  req  bigint;
begin
  select * into st from private.app_rebuild_state where id = 1 for update;

  -- 지난 요청이 실패했으면 지문을 잊어 이번에 다시 부른다
  if st.last_request_id is not null then
    select r.status_code, r.timed_out into resp from net._http_response r where r.id = st.last_request_id;
    if found then
      update private.app_rebuild_state set last_status = resp.status_code where id = 1;
      if resp.status_code is null or resp.status_code not between 200 and 299 then
        st.last_hash := null;
      end if;
    end if;
  end if;

  h := md5(public.app_policies()::text);
  if h is not distinct from st.last_hash then
    return '같음';
  end if;

  select s.decrypted_secret into hook from vault.decrypted_secrets s where s.name = 'vercel_deploy_hook';
  if hook is null or hook not like 'https://%' then
    update private.app_rebuild_state set last_result = 'Deploy Hook 주소 없음' where id = 1;
    return 'Deploy Hook 주소 없음';
  end if;

  req := net.http_post(url := hook, body := '{}'::jsonb);
  update private.app_rebuild_state
    set last_hash = h, last_request_id = req, last_called_at = now(), last_status = null, last_result = '빌드 요청'
    where id = 1;
  return '빌드 요청';
end
$$;

revoke all on function private.request_app_rebuild() from public, anon, authenticated;

-- 5분마다. 같은 이름으로 다시 부르면 예약을 덮어쓴다
select cron.schedule('app-rebuild', '*/5 * * * *', 'select private.request_app_rebuild()');
