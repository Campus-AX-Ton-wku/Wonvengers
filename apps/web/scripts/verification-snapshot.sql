-- Perky — DB 검수 결과 → 앱이 읽는 파일(apps/web/data/verification.json) 만들기
--
-- 앱은 Supabase 를 직접 읽지 않는다. 이 쿼리 결과를 파일로 저장해 커밋하면, 앱은 그 파일만 읽는다.
-- (Supabase 가 멈추거나 무료 플랜이 일시 정지돼도 앱 · 배포는 영향이 없다)
--
-- 갱신: Supabase 대시보드 → SQL Editor → 이 파일 전체 Run → 결과 칸(verification_json)의 JSON 을 복사해
--       apps/web/data/verification.json 에 통째로 붙여 넣는다 → `npm test` (값이 JSON 과 다른 정책은 검사가 알려 준다)
--
-- 넣는 것: 정책별 신뢰도, 지금 버전에서 '일치'를 남긴 사람 수 · 마지막 확인일 · 확인 방법, 원문 주소,
--          그리고 앱 JSON 과 견줄 값(요약 · 신청기간 · 나이 · 상태 · 소득 구간 · 주거 형태 · 금액).
-- 넣지 않는 것: 확인한 사람 이름(정식 앱에 공개되므로 수만 넣는다), 메모, 원문 본문.

select jsonb_pretty(jsonb_build_object(
  'generatedAt', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"'),
  'source', 'Supabase perky — policies · policy_checks (is_current 인 정책만)',
  'policies', (
    select jsonb_object_agg(p.policy_no, jsonb_build_object(
      'trustLevel', p.trust_level,
      'version', p.version,
      'confirmers', c.confirmers,
      'lastConfirmedAt', c.last_confirmed_at,
      'methods', c.methods,
      'sourceUrl', p.source_url,
      'values', jsonb_build_object(
        'summary', p.summary,
        'applyStart', p.apply_start,
        'applyEnd', p.apply_end,
        'ageMin', p.age_min,
        'ageMax', p.age_max,
        'statuses', p.statuses,
        'incomeBracketMin', p.income_bracket_min,
        'incomeBracketMax', p.income_bracket_max,
        'housingTypes', p.housing_types,
        'monthlyCap', p.monthly_cap,
        'maxMonths', p.max_months,
        'lumpSumCap', p.lump_sum_cap
      )
    ) order by p.id)
    from public.policies p
    cross join lateral (
      select count(distinct btrim(k.checked_by))::int as confirmers,
             to_char(max(k.checked_at) at time zone 'Asia/Seoul', 'YYYY-MM-DD') as last_confirmed_at,
             coalesce(jsonb_agg(distinct k.method) filter (where k.method is not null), '[]'::jsonb) as methods
      from public.policy_checks k
      where k.policy_id = p.id and k.policy_version = p.version
        and k.method in ('원문대조', '전화문의') and k.result = '일치'
    ) c
    where p.is_current and p.status <> '종료'
  )
)) as verification_json;
