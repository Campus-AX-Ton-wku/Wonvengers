-- 매일 서울 06:00(UTC 21:00) 지난 지문을 지운다 → 5분마다 도는 app-rebuild 가 다음 회차에 Vercel 빌드를 한 번 부른다.
-- 빌드 때 공공데이터에서 받는 익산 청약 공고(apps/web/scripts/fetch-notices.mjs)를 하루 한 번 새로 받으려고
-- (docs/기획/2026-11-22-청약-공고-설계.md §1). 주소 · 실패 재시도 · 대기 시간은 private.request_app_rebuild() 그대로.
select cron.schedule('app-rebuild-daily', '0 21 * * *', $$update private.app_rebuild_state set last_hash = null where id = 1$$);
