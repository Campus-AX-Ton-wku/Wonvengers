-- supabase/migrations/20261117104705_app_rebuild_timeout.sql
-- Vercel Deploy Hook 호출 대기 시간을 5초 → 30초로 (11/17)
-- 원격에 처음 적용한 직후 손으로 한 번 불렀더니 pg_net 기본 5초 안에 응답이 오지 않아 시간 초과로 남았다.
-- 시간 초과는 '실패'로 보고 다음 5분에 다시 부르므로, 짧으면 같은 빌드를 두 번 부를 수 있다.
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

  req := net.http_post(url := hook, body := '{}'::jsonb, timeout_milliseconds := 30000);
  update private.app_rebuild_state
    set last_hash = h, last_request_id = req, last_called_at = now(), last_status = null, last_result = '빌드 요청'
    where id = 1;
  return '빌드 요청';
end
$$;

revoke all on function private.request_app_rebuild() from public, anon, authenticated;
