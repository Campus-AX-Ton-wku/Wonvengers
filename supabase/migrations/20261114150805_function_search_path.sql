-- Perky DB — 함수 search_path 고정 (Supabase 보안 경고 0011 function_search_path_mutable 8건)
--
-- 함수가 부르는 쪽의 search_path 를 따라가면, 누가 같은 이름의 표·함수를 먼저 보이는 스키마에 만들어
-- 규칙(트리거)을 비켜 갈 수 있다. public · pg_temp 로 고정한다. 함수 본문과 동작은 바뀌지 않는다.

alter function public.is_region_code(text)                                                     set search_path = public, pg_temp;
alter function public.match_policies(integer, text, public.opt_status, integer, public.opt_housing, boolean, date)
                                                                                                set search_path = public, pg_temp;
alter function public.trg_checks_before()                                                       set search_path = public, pg_temp;
alter function public.trg_checks_sync()                                                         set search_path = public, pg_temp;
alter function public.trg_insert_only()                                                         set search_path = public, pg_temp;
alter function public.trg_policies_insert()                                                     set search_path = public, pg_temp;
alter function public.trg_policies_no_delete()                                                  set search_path = public, pg_temp;
alter function public.trg_policies_update()                                                     set search_path = public, pg_temp;
