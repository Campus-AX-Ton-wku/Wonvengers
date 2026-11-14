-- ════════════════════════════════════════════════════════════════════════
-- Perky DB — 처음 한 번만 넣는 데이터 (seed)
--
--   ⚠️ 이 파일은 supabase/seed/build-seed.mjs 가 만든다. 손으로 고치지 말고 스크립트를 다시 돌린다.
--   ⚠️ 한 번만 실행한다. 이미 데이터가 있으면 맨 앞 검사에서 멈추고 아무것도 넣지 않는다.
--      중간에 에러가 나도 전부 취소된다(한 묶음 transaction). 고친 뒤 다시 돌리면 된다.
--
--   적용: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여 넣기 → Run
--   미리 검사: cd supabase/tests && node seed.test.mjs  (PGlite 에 SQL + seed 를 넣어 본다)
--
--   정책 16건 (JSON 14 + 새 후보 2 '보류') · 기관·창구 23행 · 원문 2행 · 확인 기록 0행
--   JSON 데이터 커밋: 6891fb9
--
--   작성자(edited_by)는 사람 이름이 아니다 → 팀원 누구나 원문 대조 '일치'를 남길 수 있다.
--     'seed 이관(JSON 원본)'   — 14건, apps/web/data 값 그대로
--     'seed 초안(보조금24 원문)' — 새 후보 2건, 보조금24 API 응답에서 옮긴 초안
--   ggue 의 2026-11-03 재대조는 그때 ggue 가 값을 직접 고친 것이라 검수 기록이 아니라 edit_note 에 적었다.
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if exists (select 1 from public.policies) or exists (select 1 from public.agencies)
     or exists (select 1 from public.policy_raw) or exists (select 1 from public.policy_checks) then
    raise exception '이미_적재됨' using hint = 'seed 는 한 번만 넣는다. 표가 비어 있을 때만 실행하세요.';
  end if;
end $$;

-- ── ② 원문 (새 후보 2건의 보조금24 API 응답 그대로) ──
insert into public.policy_raw (kind, external_id, title, url, payload, retrieved_at, retrieved_by) values (
  '보조금24API', '468100000001', '전입세대 전입장려금', 'https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2128388&bnefType=all&svcId=468100000001',
  '{"api":"행정안전부 대한민국 공공서비스(혜택) 정보 — https://api.odcloud.kr/api/gov24/v3","query":{"cond[서비스ID::EQ]":"468100000001"},"fetchedAt":"2026-11-12T10:50:06.434Z","serviceList":{"currentCount":1,"data":[{"등록일시":"20241220091108","부서명":"기획예산과","사용자구분":"개인","상세조회URL":"https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2128388&bnefType=all&svcId=468100000001","서비스ID":"468100000001","서비스명":"전입세대 전입장려금","서비스목적요약":"전입 6개월 이상 경과 시 1명당 10만원 지역화폐 지급","서비스분야":"주거·자립","선정기준":null,"소관기관명":"전북특별자치도 익산시","소관기관유형":"시군구","소관기관코드":"4681000","수정일시":"20260811150107","신청기한":"상시신청","신청기한유형":"상시신청","신청방법":"기타 온라인신청||방문신청","전화문의":"익산시청 기획예산과/063-859-5043","접수기관":null,"조회수":1040,"지원내용":"○ 지원대상 : 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 세대 및 세대원\r\n○ 지원내용 : 전입 6개월 이상 경과 시 1명당 10만원 시 지역화폐 다이로움 지급\r\n   ※ 재전입자 중 기 지원받은 사실이 있는 경우 지원 불가 \r\n   ※ 주소전입 학생 지원사업과 중복 지원 불가\r\n○ 신청시기 : 전입 6개월 이상 경과 후 신청 \r\n○ 신청기한 : 신청가능일로부터 1년이내 \r\n○ 지원시기 : 신청 익월 15일 전후 지급","지원대상":"전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 세대 및 세대원\r\n※ 전입 6개월 이상 경과 시 신청가능 \r\n※ 주소전입 학생 지원과 중복 불가\r\n※ 재전입자 중 기 지원받은 사실이 있는 경우 지원 불가","지원유형":"현금"}],"matchCount":1,"page":1,"perPage":10,"totalCount":10942},"serviceDetail":{"currentCount":1,"data":[{"공무원확인구비서류":"해당없음","구비서류":"① 전입세대 전부 : 전입장려금 신청서 1부, 개인정보·행정정보공동이용 동의서 각 1부(세대원 모두)\r\n② 전입세대 일부 : 전입장려금 신청서·개인정보·행정정보공동이용 동의서 각 1부\r\n※ 위임시 위임장 작성 필요","문의처":"익산시청 기획예산과/063-859-5043","법령":null,"본인확인필요구비서류":"해당없음","서비스ID":"468100000001","서비스명":"전입세대 전입장려금","서비스목적":null,"선정기준":null,"소관기관명":"전북특별자치도 익산시","수정일시":"2026-08-11","신청기한":"상시신청","신청기한유형":"상시신청","신청방법":"① 거주지 읍면동 행정복지센터\r\n② 익산시 통합예약시스템 홈페이지","온라인신청사이트URL":"https://www.iksan.go.kr/reserve/index.iksan","자치법규":"익산시 인구증가시책 지원 조례(제6조)","접수기관명":null,"지원내용":"○ 지원대상 : 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 세대 및 세대원\r\n○ 지원내용 : 전입 6개월 이상 경과 시 1명당 10만원 시 지역화폐 다이로움 지급\r\n   ※ 재전입자 중 기 지원받은 사실이 있는 경우 지원 불가 \r\n   ※ 주소전입 학생 지원사업과 중복 지원 불가\r\n○ 신청시기 : 전입 6개월 이상 경과 후 신청 \r\n○ 신청기한 : 신청가능일로부터 1년이내 \r\n○ 지원시기 : 신청 익월 15일 전후 지급","지원대상":"전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 세대 및 세대원\r\n※ 전입 6개월 이상 경과 시 신청가능 \r\n※ 주소전입 학생 지원과 중복 불가\r\n※ 재전입자 중 기 지원받은 사실이 있는 경우 지원 불가","지원유형":"현금","행정규칙":null}],"matchCount":1,"page":1,"perPage":10,"totalCount":10942},"supportConditions":{"currentCount":1,"data":[{"JA0101":"Y","JA0102":"Y","JA0110":0,"JA0111":120,"JA0201":"Y","JA0202":"Y","JA0203":"Y","JA0204":"Y","JA0205":"Y","JA0301":"Y","JA0302":"Y","JA0303":"Y","JA0313":"Y","JA0314":"Y","JA0315":"Y","JA0316":"Y","JA0317":"Y","JA0318":"Y","JA0319":"Y","JA0320":"Y","JA0322":"Y","JA0326":"Y","JA0327":"Y","JA0328":"Y","JA0329":"Y","JA0330":"Y","JA0401":null,"JA0402":null,"JA0403":null,"JA0404":null,"JA0410":null,"JA0411":null,"JA0412":null,"JA0413":"Y","JA0414":null,"JA1101":null,"JA1102":null,"JA1103":null,"JA1201":null,"JA1202":null,"JA1299":null,"JA2101":null,"JA2102":null,"JA2103":null,"JA2201":null,"JA2202":null,"JA2203":null,"JA2299":null,"서비스ID":"468100000001","서비스명":"전입세대 전입장려금"}],"matchCount":1,"page":1,"perPage":10,"totalCount":10942}}'::jsonb,
  '2026-11-12T10:50:06.434Z', '노찬영 PC Claude (보조금24 API, seed/raw/)');
insert into public.policy_raw (kind, external_id, title, url, payload, retrieved_at, retrieved_by) values (
  '보조금24API', '468100000005', '주소전입 학생 지원', 'https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2167917&bnefType=all&svcId=468100000005',
  '{"api":"행정안전부 대한민국 공공서비스(혜택) 정보 — https://api.odcloud.kr/api/gov24/v3","query":{"cond[서비스ID::EQ]":"468100000005"},"fetchedAt":"2026-11-12T10:50:06.656Z","serviceList":{"currentCount":1,"data":[{"등록일시":"20251125145157","부서명":"기획예산과","사용자구분":"개인","상세조회URL":"https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2167917&bnefType=all&svcId=468100000005","서비스ID":"468100000005","서비스명":"주소전입 학생 지원","서비스목적요약":"최초학기 30만원, 이후 학기별 10만원 지급\r\n","서비스분야":"주거·자립","선정기준":null,"소관기관명":"전북특별자치도 익산시","소관기관유형":"시군구","소관기관코드":"4681000","수정일시":"20260811150202","신청기한":"상시신청","신청기한유형":"상시신청","신청방법":"기타 온라인신청||방문신청","전화문의":"익산시청 기획예산과/063-859-5288","접수기관":null,"조회수":296,"지원내용":"○ 지원대상 : 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 익산시로 전입한 익산시 소재 고등학교 및 대학교(원) 재학생\r\n○ 지원내용 : 최초학기 30만원, 이후 학기별 10만원 지급\r\n   - 고등학생 : 최대 80만원, 대학(원)생 최대 100만원\r\n   ※ 전입세대 전입장려금과 중복지원 불가\r\n   ※ 지원대상자가 지원금액 지급일 현재까지 계속하여 익산시에 주소를 두어야 함 \r\n○ 신청기간 : 전입일로부터 1년 이내 신청 가능","지원대상":"○ 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 익산시로 전입한 익산시 소재 고등학교 및 대학교(원) 재학생","지원유형":"현금"}],"matchCount":1,"page":1,"perPage":10,"totalCount":10942},"serviceDetail":{"currentCount":1,"data":[{"공무원확인구비서류":"해당없음","구비서류":"익산사랑신청서1부,  개인정보·행정정보공동이용 동의서 각 1부","문의처":"익산시청 기획예산과/063-859-5288","법령":null,"본인확인필요구비서류":"해당없음","서비스ID":"468100000005","서비스명":"주소전입 학생 지원","서비스목적":null,"선정기준":null,"소관기관명":"전북특별자치도 익산시","수정일시":"2026-08-11","신청기한":"상시신청","신청기한유형":"상시신청","신청방법":"① 거주지 읍면동 행정복지센터\r\n② 익산시 통합예약시스템 홈페이지","온라인신청사이트URL":"https://www.iksan.go.kr/reserve/index.iksan","자치법규":"익산시 인구증가시책 지원 조례(제6조)","접수기관명":null,"지원내용":"○ 지원대상 : 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 익산시로 전입한 익산시 소재 고등학교 및 대학교(원) 재학생\r\n○ 지원내용 : 최초학기 30만원, 이후 학기별 10만원 지급\r\n   - 고등학생 : 최대 80만원, 대학(원)생 최대 100만원\r\n   ※ 전입세대 전입장려금과 중복지원 불가\r\n   ※ 지원대상자가 지원금액 지급일 현재까지 계속하여 익산시에 주소를 두어야 함 \r\n○ 신청기간 : 전입일로부터 1년 이내 신청 가능","지원대상":"○ 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 익산시로 전입한 익산시 소재 고등학교 및 대학교(원) 재학생","지원유형":"현금","행정규칙":null}],"matchCount":1,"page":1,"perPage":10,"totalCount":10942},"supportConditions":{"currentCount":1,"data":[{"JA0101":"Y","JA0102":"Y","JA0110":13,"JA0111":19,"JA0201":"Y","JA0202":"Y","JA0203":"Y","JA0204":"Y","JA0205":"Y","JA0301":null,"JA0302":null,"JA0303":null,"JA0313":null,"JA0314":null,"JA0315":null,"JA0316":null,"JA0317":null,"JA0318":null,"JA0319":"Y","JA0320":"Y","JA0322":null,"JA0326":null,"JA0327":null,"JA0328":null,"JA0329":null,"JA0330":null,"JA0401":null,"JA0402":null,"JA0403":null,"JA0404":null,"JA0410":null,"JA0411":null,"JA0412":null,"JA0413":"Y","JA0414":null,"JA1101":null,"JA1102":null,"JA1103":null,"JA1201":null,"JA1202":null,"JA1299":null,"JA2101":null,"JA2102":null,"JA2103":null,"JA2201":null,"JA2202":null,"JA2203":null,"JA2299":null,"서비스ID":"468100000005","서비스명":"주소전입 학생 지원"}],"matchCount":1,"page":1,"perPage":10,"totalCount":10942}}'::jsonb,
  '2026-11-12T10:50:06.656Z', '노찬영 PC Claude (보조금24 API, seed/raw/)');

-- ── ④ 시행처·문의 창구·상담 창구 ──
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('국토교통부', '중앙부처', '00', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('국토교통부', '중앙부처', '00', '청년월세 전담 콜센터', '콜센터', '1599-0001', null, null, 'https://m.bokjiro.go.kr/ssis-tem/cms/mob/customer/notice/1309500_1155.html', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '주택과', '담당부서', '063-859-5909', null, null, 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6119d0a838c019d2421dd8e1a76', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('전북특별자치도', '시도', '52', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('전북특별자치도', '시도', '52', '인구청년정책과', '담당부서', '063-280-3884', null, null, 'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=46029', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '청년일자리과', '담당부서', '063-859-5745', null, null, 'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=48780', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('국토교통부·보건복지부', '중앙부처', '00', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('LH', '공공기관', '00', '주거급여 콜센터', '콜센터', '1600-0777', null, null, 'https://www.myhome.go.kr/hws/portal/cont/selectHousingBenefitView.do', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('국토교통부', '중앙부처', '00', '콜센터', '콜센터', '1599-0001', null, null, 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/161300000103', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('국토교통부·주택도시보증공사(HUG)', '중앙부처', '00', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('주택도시보증공사(HUG)', '공공기관', '00', '콜센터', '콜센터', '1566-9009', null, null, 'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '주택과 주거정책계', '담당부서', '063-859-5558', null, true, 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109bff42e5019c085e293a54be', '2026-11-03', null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('전북특별자치도·익산시', '시도', '52', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '주택과 주거정책계 (신혼부부 및 청년 공공임대주택 임대보증금 지원 사업)', '담당부서', '063-859-5549', null, null, 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109c55fc84019c87cf06140511', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('국토교통부·주택도시기금', '중앙부처', '00', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('교육부·한국장학재단 청년주거지원부', '중앙부처', '00', '', '담당부서', null, null, null, null, null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('한국장학재단', '공공기관', '00', '대학생 연합생활관(고양)', '담당부서', '031-920-7200', null, null, 'https://www.kosaf.go.kr/ko/notice.do?mode=view&searchStr=&searchType=&page=1&ctgrId1=0000000009&ctgrId2=&seqNo=20960', null, null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산청년시청', '시군구', '52140', '', '청년센터', '063-859-7384', '월~금 09:00~20:00 · 토 09:00~18:00 · 일 09:00~18:00(1층 청년민원실·오락실만 운영) · 평일(월~금) 법정공휴일 휴관', true, 'https://youthforest.iksan.go.kr/index.iksan?menuCd=DOM_000000105003000000', '2026-11-03', null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('전북청년허브센터', '공공기관', '52', '', '청년센터', '063-227-2030', null, true, 'https://www.jb2030.or.kr/center/c4.html', '2026-11-03', null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('마이홈 콜센터', '공공기관', '00', '', '콜센터', '1600-1004', '평일 09:00~18:00 (점심 12:00~13:00)', true, 'https://www.myhome.go.kr/hws/portal/main/getMgtMainPage.do', '2026-11-03', null);
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '기획예산과', '담당부서', '063-859-5043', null, null, null, null, (select id from public.policy_raw where kind = '보조금24API' and external_id = '468100000001'));
insert into public.agencies (name, level, region_code, department, contact_kind, phone, hours, offers_consult, homepage, verified_at, raw_id) values ('익산시', '시군구', '52140', '기획예산과 (주소전입 학생 지원)', '담당부서', '063-859-5288', null, null, null, null, (select id from public.policy_raw where kind = '보조금24API' and external_id = '468100000005'));

-- ── ③ 가공 정책 ──
-- 청년월세 지원 (2026년 상시사업 전환) (apps/web/data/policies.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'moland-youth-rent-support', 2026, null, (select id from public.agencies where name = '국토교통부' and department = ''), (select id from public.agencies where name = '국토교통부' and department = '청년월세 전담 콜센터'),
  'https://m.bokjiro.go.kr/ssis-tem/cms/mob/customer/notice/1309500_1155.html', 'https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=WLF00004661', '청년월세 지원 (2026년 상시사업 전환)', '현금', '주거비 경감', '운영',
  '실제 납부 월세 범위 내 월 최대 20만원, 생애 1회 최대 24개월 (총 최대 480만원)',
  '2026-03-30', '2026-05-29', 19, 34,
  array['00']::text[], '전국', array['대학생', '재직', '구직']::public.opt_status[],
  null, 3, array['월세', '연세']::public.opt_housing[],
  'rent_capped_monthly'::public.opt_benefit_type, 200000, 24,
  null, null, array['youth-rent-cash-support']::text[], array['birthDate', 'livesApartFromParents', 'canRegisterResidence', 'hasNoHouse', 'isContractHolder', 'householdSize', 'useOriginHousehold', 'ownHouseholdMonthlyIncome', 'originHouseholdMonthlyIncome', 'receivingOtherRentSupport']::text[],
  '[JSON 기타 칸] {"youthPolicyNo":"20260319005400112218","gov24ServiceId":"161300000099"}

2026-11-03 재대조: 복지로 공지(등록 2026-03-20) 원문과 익산시 고시공고 ''2026년 정부형(국토부) 청년월세 지원사업 신청 안내''(주택과, 2026-03-25)를 다시 열어 신청기간(3/30 09시~5/29 16시)·월 20만원×최대 24개월·19~34세·청년가구 중위 60%/원가구 100% 이하가 그대로임을 확인했다. 연락처는 복지로 공지의 ''전담 콜센터 국토교통부 ☎1599-0001''이다(익산시 안내문도 같은 번호와 익산시청 콜센터 1577-0072를 적는다). 복지로 공지 ''2026년 청년월세 지원 신청 안내'' 원문으로 확인(2026-08-23). 만 19~34세(1991~2007년생), 청년가구 중위소득 60% 이하 + 원가구 100% 이하, 월 20만원 × 최대 24회 생애 1회, 2026년 신규 6만명. 재학·재직·구직 제한은 공지에 없음. ⚠️ 2026년부터 상시사업으로 전환됐지만 접수 창구는 연중 열려 있지 않다 — 2026년 접수는 3/30 09시~5/29 16시로 이미 종료됐고, 선정자 발표는 9/14, 5월분 월세부터 소급 지급된다. 따라서 오늘 기준 판정은 ''신청 불가(접수 종료)''가 정상이다. 신규 수혜자는 2028년 12월까지만 지원. 재산기준은 익산시 안내문(2026-03-25)에서 ''청년독립가구 1억 22백만원 이하 및 원가구 4억 7천만원 이하''로 확인했다(복지로 공지에는 없음) — 이 앱은 재산을 묻지 않아 코드에서 판정하지 않는다. 월세만 인정, 관리비는 지원 대상 금액에서 제외.',
  'seed 이관(JSON 원본)',
  'apps/web/data/policies.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 익산형 청년월세 지원사업 (apps/web/data/policies.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-youth-rent-support', 2026, null, (select id from public.agencies where name = '익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '주택과'),
  'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6119d0a838c019d2421dd8e1a76', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6119d0a838c019d2421dd8e1a76', '익산형 청년월세 지원사업', '현금', '주거비 경감', '운영',
  '실제 납부 월세 범위 내 월 최대 20만원 × 최대 12개월 (총 최대 240만원), 선착순 250명 한정',
  '2026-04-15', '2026-09-30', 19, 34,
  array['52140']::text[], '전북특별자치도 익산시', array['대학생', '재직', '구직']::public.opt_status[],
  3, 5, array['월세', '연세']::public.opt_housing[],
  'rent_capped_monthly'::public.opt_benefit_type, 200000, 12,
  null, null, array['youth-rent-cash-support']::text[], array['birthDate', 'livesApartFromParents', 'hasNoHouse', 'householdSize', 'ownHouseholdMonthlyIncome', 'assetsUnder107M']::text[],
  '[JSON 기타 칸] {"youthPolicyNo":"20260326005400212297"}

2026-11-03 재대조: 익산시 고시공고 ''2026년 익산형 청년월세 지원사업 신청 안내''(주택과, 2026-03-25)와 첨부 안내문(hwp) 원문을 열었다 — 신청기간 2026-04-15 ~ 09-30, 신규 230여명(예산 범위 내 변동 가능), 월 20만원 한도 최대 12개월(생애 1회), 19~34세(1991~2007년생), 청년가구 중위 130% 이하 & 원가구 중위 100% 이하, 재산 청년가구 1억 700만원 이하 & 원가구 4억 7천만원 이하, 임차보증금 5천만원·월세 60만원 이하(월세가 60만원을 넘어도 보증금 월세 환산액과 합산 70만원 이하면 가능), 주소지 행정복지센터 방문 신청(온라인 불가), 정부형 부적합자 중 신청가능자에게 문자·서면으로 개별 안내. 문의 주택과 063-859-5909 또는 익산시청 콜센터 1577-0072. 원문이 복지로 페이지(스크립트 렌더링이라 열리지 않음) 대신 이 공고라 sourceUrl·applyUrl 을 바꿨다. ⚠️ 아래 이전 기록의 원가구 재산 ''3억 8,000만원''은 원문과 달라 ''4억 7,000만원''으로 고쳤다(코드는 원가구 재산을 판정하지 않으므로 판정 결과는 바뀌지 않는다). 2026년 회차는 9/30 로 끝났고 다음 회차는 원문에 없다. 2026년 회차 확인(2026-08-30). 신청기간 2026-04-15 ~ 2026-09-30, 모집 230명, 선착순 아님. 팀이 익산시에 직접 확인했다(2026-08-30). 온통청년 등록(plcyNo 20260326005400212297, 2026-03-26 등록 · 2026-06-05 갱신)과도 일치한다. ⚠️ 이전 값(2026-01-01~12-31, 선착순 250명)은 2024년 사업 기준 보도자료·뉴시스 기사에서 옮긴 추정치였다 — 실제 2026년 회차는 4월에 열려 9월에 닫힌다. 신선도 감지가 잡아낸 건이다. 요건도 2026년 공고(익산 청년숲)로 확인했다(2026-08-30): 19~34세 무주택, 임차보증금 5,000만원·월 임차료 60만원 이하 주택에 부모와 별도 거주, 청년가구 중위소득 130% 이하·재산 1억 700만원 이하, 행정복지센터 방문 신청(온라인 불가). ⚠️ **원가구 요건이 코드에 없다** — 공고는 원가구 중위소득 100% 이하·재산 4억 7,000만원 이하도 요구하는데 policy-rules.ts 의 iksan 규칙은 본인 가구만 본다. 부모 소득이 높아 탈락할 사람에게 ''예상 적용''이라고 말할 수 있다. requiredInputs 에 원가구 항목을 추가해야 하므로 2층 질문이 늘어난다 — 별도 판단이 필요하다. ⚠️ **소득 하한(60% 초과)은 공고에 없다** — 공고와 온통청년 모두 ''130% 이하''만 적는다. 아래 복지로 근거대로 ''국토부 사업 탈락자''라는 절차 요건을 소득 하한으로 근사한 값인데, 그 대가로 중위 60% 이하 청년에게 이 정책이 ''대상 아님''으로 표시된다. 유지 여부는 별도 판단이 필요하다. ⚠️ 복지로 지자체 복지서비스 페이지는 대상을 ''청년가구 소득초과로 정부형 청년월세 부적합 판정을 받은 자''로 적고 있다 — 소득 구간이 아니라 ''국토부 사업에 신청해서 소득 초과로 탈락했다''는 절차 요건이다. 소득 밴드(60~130%)는 그 상황을 근사한 값이므로, 실제로는 국토부 사업 신청·탈락 이력이 필요할 수 있다. 소득 하한이 있는 유일한 정책이라 discovery.incomeBracketMin(3) + incomeBracketMax(5)를 함께 쓴다 — 중위 60%(월 1,538,543원)와 130%(월 3,333,509원)가 각각 3번·5번 구간에 걸쳐 있다. 하한을 빼고 상한만 넣으면 저소득 청년 전원에게 ''가능성 있음''이 잘못 표시된다. ⚠️ 선착순이 아니므로 조기 마감 문구는 뺐다. 다만 230명 정원이 있어 정원 초과 시 선정에서 탈락할 수 있고, 그 현황은 앱에서 알 수 없다.',
  'seed 이관(JSON 원본)',
  'apps/web/data/policies.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 전북청년 지역정착 지원사업 (apps/web/data/policies.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'jeonbuk-youth-settlement-support', 2026, null, (select id from public.agencies where name = '전북특별자치도' and department = ''), (select id from public.agencies where name = '전북특별자치도' and department = '인구청년정책과'),
  'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=46029', 'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=46029', '전북청년 지역정착 지원사업', '현금', '이주·정착', '운영',
  '월 30만원 × 최대 12개월 (총 최대 360만원). 포인트 30% + 익산사랑상품권 70%로 지급 (전액 현금 아님)',
  '2026-03-06', '2026-04-10', 18, 39,
  array['52']::text[], '전북특별자치도', array['재직']::public.opt_status[],
  null, 5, null,
  'flat_monthly'::public.opt_benefit_type, 300000, 12,
  null, null, array[]::text[], array['birthDate', 'jeonbukResidentOverOneYear', 'employedInTargetSectorOver3Months', 'householdSize', 'ownHouseholdMonthlyIncome']::text[],
  '[JSON 기타 칸] {"youthPolicyNo":"20250113005400210206","gov24ServiceId":"654000000009"}

2026-11-03 재대조: 수정공고문(익산시 공고 제2026-975호, 2026-03-17, 첨부 hwpx)과 추가모집 공고(2026-03-30) 원문을 열었다 — 본모집 3/6~3/20 17시, 추가모집 3/30~4/10 17시, 선정인원 485명, 정량평가(소득 30·활동기간 30·거주기간 20·나이 20점, 선착순 아님), 나이는 2025-12-31 기준 18~39세(1986.1.1.~2007.12.31.), 재학·휴학생 제외, 발표 2026-05-08, 매월 9만 포인트 + 21만원 익산사랑상품권. 공고문 문의처는 ''전북특별자치도 인구청년정책과(☎280-3884), 익산시 청년일자리과(☎859-7382)''(지역번호 063 생략 표기)다 — 이 항목의 지역 범위가 전북 전체라 contact 에는 도 담당 부서를 넣었다. 접수 사이트(ttd.ezwel.com)는 첫 화면 외에 고정 주소가 없어 applyUrl 을 모집공고 페이지로 바꿨다(공고에 사이트 링크가 있다). 다음 회차는 원문에 없다. 익산청년시청 ''2026년 전북청년 지역정착 지원사업 모집공고(수정)''와 ''추가 모집공고'' 원문으로 확인(2026-08-23). 18~39세, 공고일 기준 1년 이상 거주, 농업·임업·어업·중소기업(정규직)·문화예술·연구소기업(정규직)에 3개월 이상 계속 종사, 가구 중위소득 150% 이하, 월 30만원 × 최대 12개월(포인트 30% + 익산사랑상품권 70%), 온라인 접수(ttd.ezwel.com). (이전 기록의 ''문의 063-859-7384''는 익산청년시청 누리집 하단 대표번호다 — 공고문 문의처는 위 2026-11-03 재대조 참고.) ⚠️ 신청기간은 본모집 3/6~3/20 17시, 추가모집 3/30~4/10 17시로 두 차례였다 — 데이터 모델에 창구가 하나뿐이라 3/6~4/10 으로 합쳐 넣었고, 오늘 기준 판정은 ''신청 불가(접수 종료)''가 정상이다. discovery.statuses 를 ''재직''만 둔 이유: 대상 업종 정규직 3개월 이상 재직이 필수 요건이라 재학·구직 상태로는 대상이 되지 않는다(재학과 정규직을 병행하는 경우는 1층에서 ''해당 없음''으로 나오므로 2층 판정으로 확인해야 한다). 지급액의 70%가 현금이 아닌 지역화폐이므로 결과 화면에 반드시 표시할 것. 다른 월세지원과의 중복 수급 가능 여부는 공고에 명시되어 있지 않아 현재는 중복 허용으로 가정한다.',
  'seed 이관(JSON 원본)',
  'apps/web/data/policies.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 익산시 전입 청년 이사비·중개보수 지원사업 (apps/web/data/policies.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-newcomer-moving-cost-support', 2026, null, (select id from public.agencies where name = '익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '청년일자리과'),
  'https://youthforest.iksan.go.kr/board/view.iksan?boardId=BBS_0000015&menuCd=DOM_000000105002001000&dataSid=44273', 'https://youthforest.iksan.go.kr/index.iksan?menuCd=DOM_000000102007002000', '익산시 전입 청년 이사비·중개보수 지원사업', '현금', '이주·정착', '운영',
  '이사비(최대 30만원) + 부동산 중개보수(최대 20만원) 실비를 1인당 최대 50만원까지 생애 1회 지원',
  '2026-01-02', '2026-05-14', 18, 39,
  array['52140']::text[], '전북특별자치도 익산시', array['대학생', '재직', '구직']::public.opt_status[],
  null, 5, null,
  'lump_sum'::public.opt_benefit_type, null, null,
  500000, 'oneTimeMoveCost', array[]::text[], array['birthDate']::text[],
  '⚠️ 2026-11-03 재대조: 2026년 사업은 예산 조기 소진으로 마감됐다. 익산청년시청 ''익산시 전입 청년 부동산 중개보수비 및 이사비 지원사업 마감 안내''(2026-05-14, 청년일자리과)가 ''예산이 조기 소진되어 사업 신청이 마감''됐고 ''향후 사업 신청 재개 시 별도의 공지가 있을 예정''이라고 적는다 — 재개 공지는 2026-11-03 기준 게시판에서 찾지 못했다(nextRound 는 일정이 없어 null). 2026년 회차 원문은 ''2026년 전입 청년 부동산 중개보수비 및 이사비 지원사업 모집 공고''(익산시 공고 제2026-5호, 2026-01-02, 첨부 hwp): 사업기간 2026.1.~12. 상시모집·예산 소진 시 조기 마감, 2025-01-01 이후 관외에서 익산시로 전입한 18~39세(1986.1.1.~2007.12.31.) 1인 가구, 가구 중위 150% 이하, 이사비 30만원·중개보수 20만원 한도 실비(생애 1회), 익산청년시청 온라인 신청, 문의 청년일자리과 063-859-5745. 제외: 주거급여 수급자, 타 기관 이사비 수혜자, 부모 집으로 이사하는 경우. 선정인원은 같은 공고 안에서 ''85명''(1항)과 ''100명 선발 예정''(5항)으로 서로 다르다. applicationStart 를 2026-01-02(공고일 — 공고는 신청기간을 ''2026. 1. ~ 12.''로만 적는다)로, applicationEnd 를 마감 안내 게시일 2026-05-14 로 바꿨다. 이전 sourceUrl(사업안내 메뉴)은 아직 2025년 회차의 ''2025. 10. 13. ~ 예산 소진 시까지''를 보여 줘서 2026년 공고로 바꿨다. 아래는 2025년 회차 기준으로 쓴 이전 기록이다. 익산청년시청 ''전입 청년 부동산 중개보수비 및 이사비 지원사업'' 안내 원문으로 확인(2026-08-23). 2025-01-01 이후 익산시로 전입신고를 완료한 18~39세 1인 가구 청년, 가구 기준 중위소득 150% 이하, 외국인·재외국민 제외. 이사비(차량대여비·운반비·포장비 등, 청소비 제외) 30만원 한도 + 중개보수 20만원 한도 내 실비, 생애 1회. 접수는 2025-10-13부터 예산 소진 시까지 상시모집, 익산청년시청 온라인 신청, 문의 063-859-5745. applicationStart 에는 접수 시작일이 아니라 전입 기준일(2025-01-01)이 들어가 있었으므로 실제 접수 시작일로 바로잡았다. ⚠️ 다음 조건은 코드에서 판정하지 않는다: (1) ''2025-01-01 이후 익산시 전입'' — 전입일 입력 항목이 없음, (2) ''1인 가구'' 요건. 이 항목은 나이(18~39세)만 판정한다. ⚠️ 예산 소진 시 마감이라 상시모집이어도 실제 접수 가능 여부는 앱에서 알 수 없다.',
  'seed 이관(JSON 원본)',
  'apps/web/data/policies.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 청년 주거급여 분리지급 (apps/web/data/policies.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'youth-housing-benefit-split-payment', 2026, null, (select id from public.agencies where name = '국토교통부·보건복지부' and department = ''), (select id from public.agencies where name = 'LH' and department = '주거급여 콜센터'),
  'https://www.myhome.go.kr/hws/portal/cont/selectHousingBenefitView.do', 'https://www.myhome.go.kr/hws/portal/cont/selectHousingBenefitView.do', '청년 주거급여 분리지급', '현금', '주거비 경감', '운영',
  '부모 가구와 다른 시·군·구에 거주하는 미혼 청년에게, 지역 급지별 기준임대료 한도 내 실제 월세만큼 매월 지급 (익산시는 4급지 — 1인 가구 월 최대 21만 2천원)',
  '2026-01-01', null, 19, 29,
  array['00']::text[], '전국', array['대학생', '재직', '구직']::public.opt_status[],
  null, null, null,
  'rent_capped_monthly'::public.opt_benefit_type, 212000, null,
  null, null, array['youth-rent-cash-support']::text[], array['birthDate', 'livesApartFromParents', 'householdSize', 'originHouseholdMonthlyIncome']::text[],
  '[JSON 기타 칸] {"youthPolicyNo":"20250617005400110952"}

2026-11-03 재대조: 마이홈 ''주거급여 소개 및 선정기준'' 원문 — 2026년 4인 가구 선정기준 3,117,474원(중위 48%), 2026년 기준임대료 ''그 외'' 지역 1인 212,000원 그대로. 3급지 열 이름이 ''광역시·세종·수도권 외 특례시''라 익산(특례시 아님)은 ''그 외''다. 관련문의는 ''읍면동 행정복지센터 또는 주거급여콜센터(1600-0777)''(같은 페이지 하단 ''LH 주거급여 콜센터 1600-0777''). 청년 분리지급 세부 요건(19세 이상 30세 미만 미혼 등)은 이 페이지에 없고 2026-08-23 에 본 복지로 안내 기준이다 — 이번에 2026년 현행 공식 안내를 따로 찾지는 못했다. applyUrl 을 복지로 첫 화면에서 이 페이지(신청 방법: 행정복지센터 방문·복지로 인터넷 접수 안내)로 바꿨다 — 복지로 신청 화면은 스크립트 렌더링이라 직접 주소를 확인하지 못했다. 마이홈 ''주거급여 소개 및 선정기준''(2026년도 적용기준)과 복지로 ''청년 주거급여 분리지급 신청 안내'' 원문으로 확인(2026-08-23). 선정기준은 소득인정액 기준 중위소득 48% 이하(2026년 1인 가구 월 1,230,834원), 대상은 만 19세 이상 30세 미만 미혼 청년, 청년 명의 임대차계약 + 전입신고 필수, 기준임대료 상한 내 실제 임차료를 매월 20일 청년 명의 계좌로 별도 지급. monthlyCap 을 170,000원(추정)에서 212,000원으로 고쳤다 — 2026년 기준임대료 4급지(그 외 지역, 익산 포함) 1인 가구 값이다(급지별 1인: 1급지 369,000 / 2급지 300,000 / 3급지 247,000 / 4급지 212,000). ⚠️ 복지로 안내 페이지에는 소득기준이 ''중위소득 45% 이하''로 적혀 있는데 이는 2021년 시행 당시 값이다. 2026년 기준은 마이홈 표의 48% 다. ⚠️ 다음 조건은 코드에서 판정하지 않는다: (1) 미혼 여부 — 입력 항목 없음, (2) 부모 가구가 이미 주거급여 수급가구여야 한다는 요건 — 지금은 ''원가구 소득 48% 이하''로 근사하지만 실제로는 부모가 수급자로 선정되어 있어야 한다, (3) 거주지 요건은 ''부모와 주민등록상 시·군을 달리할 것''(동일 시·군도 보장기관 인정 시 예외)인데 ''부모와 별도 거주''로 근사 처리한다, (4) 부모 가구 주거유형이 사용대차·공동생활가정이면 신청 불가. ⚠️ discovery.incomeBracketMax 를 null 로 남긴 이유: 본인 소득이 아니라 부모를 포함한 원가구 소득인정액으로 심사한다. 1층 질문은 본인 월소득 구간만 묻기 때문에 원가구 가구원 수를 모르는 상태로는 소득으로 탈락시킬 수 없다(예: 본인 250만원이라도 원가구가 6인이면 48% 기준 안에 들어온다). 원가구 소득 기준을 본인 가구원 수 테이블로 계산하는 2층 코드 관례도 부정확할 수 있어 함께 검수할 것.',
  'seed 이관(JSON 원본)',
  'apps/web/data/policies.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 전세보증금반환보증 보증료 지원 (apps/web/data/policies.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'jeonse-return-guarantee-fee-subsidy', 2026, null, (select id from public.agencies where name = '국토교통부' and department = ''), (select id from public.agencies where name = '국토교통부' and department = '콜센터'),
  'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/161300000103', 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/161300000103', '전세보증금반환보증 보증료 지원', '보증료', '보증금 안전', '운영',
  '이미 낸 전세보증금반환보증(HUG·HF·SGI) 보증료를 최대 40만원까지 1회 지원 (2025-03-30 이전 가입건은 최대 30만원)',
  '2026-01-01', null, null, null,
  array['00']::text[], '전국', array['대학생', '재직', '구직']::public.opt_status[],
  null, null, array['전세']::public.opt_housing[],
  null, null, null,
  400000, null, array[]::text[], array['birthDate', 'hasNoHouse', 'isContractHolder']::text[],
  '[seed] JSON benefitType=lump_sum, lumpSumBasis=notCalculable — 지원 형태가 ''보증료''라 DB 규칙상 benefit_type 은 비웠다.

[JSON 기타 칸] {"youthPolicyNo":"20260527005400113223","gov24ServiceId":"161300000103"}

2026-11-03 재대조: 정부24 원문(최종수정일 2026-05-08) — 상시신청·연중(지자체별 예산 소진 시 조기 마감), 최대 40만원(''25.3.30 이전 가입건 최대 30만원), 청년외 90%, 보증금 3억원·연소득 청년 5천만원/청년외 6천만원/신혼 7.5천만원 이하, 문의처 ''국토교통부 ☎1599-0001'' — 값 변동 없음. 익산시 고시공고 ''2026년 전세보증금 반환보증 보증료 지원사업 신청자 접수''(주택과, 2026-04-02)는 온라인 신청처로 정부24·HUG 안심전세포털, 오프라인으로 주소지 행정복지센터를 적고, 청년을 ''신청일 기준 18~39세''로 정의한다(소득 상한 구분용). 같은 익산 공고 본문의 신청기간이 ''2025. 1. 28. ~ 2025. 12. 18.''로 적혀 있어 전년도 문구가 남은 것으로 보인다 — 익산 접수 마감일은 확인 필요. loan-products.json 에 같은 id 로 중복 등록돼 있던 미검증 초안은 지웠다(이 엔트리가 정본). 정부24 ''전세보증금반환보증 보증료 지원'' 안내 원문과 온통청년 등록(plcyNo 20260527005400113223, 2026-05-27 갱신)을 대조해 확인했다(2026-08-31). 대상은 신청일 기준 유효한 전세보증금반환보증(HUG·HF·SGI)에 가입한 임차보증금 3억원 이하 무주택 임차인, 연소득 기준은 청년 5천만원·청년외 6천만원·신혼부부 7.5천만원 이하. 이미 낸 보증료를 최대 40만원 한도로 지원하며 청년외는 납부액의 90%까지. 상시신청이되 지자체별 예산 소진 시 조기 마감. 시·군·구청·주민센터 방문 또는 온라인 접수. ⚠️ discovery.ageMin/ageMax 를 null(나이 제한 없음)로 뒀다 — 정부24 안내에 연령 요건이 없고 온통청년 등록도 sprtTrgtAgeLmtYn=''Y''(나이 제한 없음)다. ''청년''은 자격 요건이 아니라 소득 상한을 가르는 구분이라, 만 19~34세로 적으면 없는 제한을 만들어 대상자를 탈락시킨다. ⚠️ discovery.incomeBracketMax 를 null 로 뒀다 — 기준이 연소득 5천만원(월 약 417만원)이라 1층의 월 소득 구간(최대 ''250만원 초과'')으로는 상한을 가를 수 없다. 250만원 초과 구간에 5천만원 이하인 사람과 넘는 사람이 함께 들어온다. ⚠️ applicationStart 는 ''상시신청''을 데이터 모델에 담기 위해 2026-01-01 로 뒀다. 실제 접수 시작일이 아니며, 지자체 예산 소진 시 조기 마감되는 현황은 앱에서 알 수 없다. ⚠️ 다음 조건은 코드에서 판정하지 않는다: (1) 보증 가입 여부 — 이미 가입해 보증료를 낸 사람만 대상인데 입력 항목이 없다, (2) 보증금 3억원 이하, (3) 연소득 기준. ⚠️ lumpSumBasis 가 notCalculable 이다 — 2층 계약 화면은 보증료를 입력받지 않아 개인 예상액을 계산하지 않는다(공고 상한만 보여준다).',
  'seed 이관(JSON 원본)',
  'apps/web/data/policies.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 청년전용 버팀목 전세자금대출 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'youth-btm-jeonse-loan', 2026, null, (select id from public.agencies where name = '국토교통부·주택도시보증공사(HUG)' and department = ''), (select id from public.agencies where name = '주택도시보증공사(HUG)' and department = '콜센터'),
  'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp', 'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020301.jsp', '청년전용 버팀목 전세자금대출', '대출', '주거비 경감', '운영',
  '만 19~34세 무주택 세대주(예비세대주 포함), 부부합산 연소득 5천만원 이하·순자산 3.45억원 이하 대상. 연 2.2~3.3%(부부합산 연소득별, 대출대상주택이 지방 소재면 0.2%p 인하)로 임차보증금 3억원 이하·전용 85㎡ 이하 주택 전세금의 80% 이내, 최대 1.5억원(만 25세 미만 단독세대주 1.2억원)까지 대출.',
  null, null, null, null,
  array['00']::text[], '전국', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

주택도시기금 ''청년전용 버팀목전세자금'' 상품안내 원문으로 확인(2026-11-03). ⚠️ 이전 요약의 ''최저 약 2.0%대''·''최대 2억원''은 원문과 달랐다 — 현재 금리 연 2.2~3.3%(부부합산 연소득 2천만원 이하 2.2% ~ 6천만원 초과 7.5천만원 이하 3.3%), 호당 한도 1.5억원(2억원은 2025-06-27 이전 계약분). 소득 예외: 혁신도시 이전 공공기관 종사자·다자녀·2자녀 가구 6천만원, 신혼가구 7.5천만원 이하. 중소·중견기업 취업 청년 등은 병역 복무기간만큼 최대 만 39세까지 연장. 대출 심사 상담은 ''주택도시보증공사 콜센터 1566-9009 및 기금 수탁은행 지점''. 이전 sourceUrl(마이홈 페이지)은 본문을 스크립트로 불러와 열람되지 않아 주택도시기금 상품 페이지로 바꿨다. 이자 절감액은 계산하지 않음(대출 실행 시점 금리·개인 신용도에 따라 달라짐) — 정확한 한도·금리는 주택도시기금 홈페이지 또는 콜센터(1566-9009)에서 확인. 연세 계약에는 적용되지 않을 수 있음(전세 계약 대상 상품).',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 청년전용 보증부월세대출 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'youth-btm-monthly-rent-loan', 2026, null, (select id from public.agencies where name = '국토교통부·주택도시보증공사(HUG)' and department = ''), (select id from public.agencies where name = '주택도시보증공사(HUG)' and department = '콜센터'),
  'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020701.jsp', 'https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020701.jsp', '청년전용 보증부월세대출', '대출', '주거비 경감', '운영',
  '만 19~34세 무주택 단독세대주(예비세대주 포함), 부부합산 연소득 5천만원 이하·순자산 3.45억원 이하 대상. 전용 60㎡ 이하(주거용 오피스텔 포함)·보증금 6.5천만원·월세 70만원 이하 주택의 보증금을 연 1.3%로 최대 4,500만원, 월세를 최대 1,200만원(24개월 기준 월 50만원 이내, 연 0%(20만원 한도)·1.0%(20만원 초과))까지 대출. 25개월 만기 일시상환(최장 10년 5개월).',
  null, null, null, null,
  array['00']::text[], '전국', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

주택도시기금 ''청년전용 보증부월세대출'' 상품안내 원문으로 확인(2026-11-03). 신청 시기: 잔금지급일과 전입일 중 빠른 날로부터 3개월 이내(갱신은 갱신일로부터 3개월 이내). 대출한도는 호당한도·소요자금 비율(신규: 보증금+월세 24개월 환산 합계가 전세금액의 80% 이내, 보증금 대출은 70% 이내)·담보(HUG 전세금안심대출보증) 한도 중 작은 금액, 1년 미만 재직자는 2천만원 이하로 제한될 수 있다. 자산심사 부적격자는 가산금리. 제외: 기금·은행 전세자금·주택담보대출 이용 중, 공공임대주택 입주 중(퇴거 시 가능), 쉐어하우스 입주자. 월세금 대출은 매월 약정일에 임대인 통장으로 지급. 대출 심사 상담은 ''주택도시보증공사 콜센터 1566-9009 및 기금 수탁은행 지점''(자산심사는 1551-3119). 온통청년 등록(plcyNo 20260922005400113545)과 금리·한도가 같다. ⚠️ 온통청년 ''청년 전월세 대출보증''(금융위, plcyNo 20260923005400113576)의 ''보증금 1억원 이하·월세 70만원 이하''는 다른 상품(HF 보증) 조건이다 — 이 상품의 대상주택은 원문대로 보증금 6.5천만원·월세 70만원 이하. 이 앱은 대출 여부·자산을 묻지 않아 자격을 자동 판정하지 않는다(정보 제공만). 이자 절감액은 계산하지 않는다.',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 신혼부부·청년 주택구입 대출이자 지원사업 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-youth-home-purchase-loan-interest', 2026, null, (select id from public.agencies where name = '익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '주택과 주거정책계'),
  'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109bff42e5019c085e293a54be', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109bff42e5019c085e293a54be', '신혼부부·청년 주택구입 대출이자 지원사업', '대출', '자산 형성', '운영',
  '익산시에 주소를 두고 2024-07-01 이후 주택(전용 85㎡ 이하·주택가액 6억원 이하, 1가구 1주택)을 구입한 19~39세 청년의 주택구입 대출잔액 3.0% 이내 이자를 지원(기본 대출잔액 1억원 한도·연 최대 300만원, 전입자·혼인가구 2억원 한도·연 최대 600만원). 소득기준 미혼 본인 연 6천만원·기혼 부부합산 연 1억원 이하. 지원기간 최대 5년(기본 3년, 자녀 수 증가 시 최대 5년).',
  null, null, null, null,
  array['52140']::text[], '전북특별자치도 익산시', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

익산시 고시공고 ''2026년 신혼부부·청년 주택구입 대출이자 지원사업 신청자 접수''(주택과, 2026-01-29)와 첨부 공고문(익산시 공고 제2026-366호, hwp) 원문으로 확인(2026-11-03). 익산청년시청 게시글(dataSid=45005, 2026-02-09)도 같은 내용이다. 신청기간 2026-03-03 ~ 12-31(예산 소진 시까지), 방문(인북로32길 1, 8층 주택과) 또는 전자우편 신청, 문의 주택과(주거정책계) 063-859-5558·5953. 지원율은 기본지원율(연소득 구간별 1.5~2.0%) + 추가지원율(기본 최대 1.0%, 전입자·혼인가구 최대 1.5%)로 연 최대 3.0%, 반기별(7월·12월) 지급 — 신청한 반기의 다음 반기에 낸 이자부터 지원한다. 미혼 본인 연소득 3천만원 이하면 부모 연소득 1억 3천만원·재산가액 5억 5천만원 이하도 충족해야 한다. 대상자는 매입 주택의 소유자여야 하고 그 외 세대원은 무주택이어야 한다. 대출은 2024-07-01 이후 실행된 주택구입 용도(거래내역확인서에 ''매매'')여야 하며 신용·일반대출은 불가. 공고문에 선착순·모집 규모 언급은 없다(온통청년 API 의 ''선착순 1,300명''은 원문에서 확인되지 않음). ⚠️ 온통청년 API 등록값(plcyNo 20260325005400212264)의 aplyYmd(2026-07-01~12-31)는 원문(3/3 시작)과 다르다 — 원문을 따른다. 이 앱은 주택 구입·대출 여부를 묻지 않아 자격을 자동 판정하지 않는다(정보 제공만).',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 청년 전세자금 대출이자 지원사업 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-youth-jeonse-loan-interest', 2026, null, (select id from public.agencies where name = '익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '주택과 주거정책계'),
  'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109d298170019d422a39a82c29', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109d298170019d422a39a82c29', '청년 전세자금 대출이자 지원사업', '대출', '주거비 경감', '운영',
  '익산시에 주민등록을 두고 민간주택(전용 85㎡ 이하·전세보증금 3억원 이하)에 전세로 사는 18~39세 무주택 미혼 청년에게 본인 명의 전세자금 대출이자를 연 최대 150만원(최대 연 3%) 지원. 소득 기준중위소득 180% 이하(건강보험료 본인부담금 기준). 매년 신규 신청, 요건 충족 시 최대 2년. 2026년 하반기 신청 2026-12-01 ~ 12-11(익산시청 주택과 방문 접수).',
  null, null, null, null,
  array['52140']::text[], '전북특별자치도 익산시', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

익산시 익산소식 게시글 ''「2026년 청년 전세자금 대출이자 지원사업」신청자 모집 공고''(주택과, 2026-03-31)와 첨부 공고문(익산시 공고 제2026-1129호, hwp — 사이트 Synap 미리보기로 9쪽 전부 열람) 원문으로 확인(2026-11-03). 신청기간 상반기 2026-06-01 ~ 06-19(이자 ''25.12~''26.5분, 6월 말 지급)·하반기 2026-12-01 ~ 12-11(이자 ''26.6~''26.11분, 12월 말 지급) — 상반기 신청자는 하반기에 초본·이자납입내역서를 추가 제출, 예산 상황에 따라 하반기 최초 신청자도 상반기분 지급. 대상 18~39세(1987-01-01 ~ 2008-12-31 출생) 미혼청년, ''25.12~''26.11 전세자금 대출이자 납부자, 본인 명의 임대차·본인 명의 금융권 주택전세자금 대출. 신청물량 초과 시 기준중위소득 낮은 순 선정. 제외: 기초생계·의료·주거급여 수급자, 공공임대(영구·국민·행복·매입·전세) 거주자, 신용·일반·마이너스 대출, 직계혈족 및 그 배우자와의 임대차, 해당연도 정부·지자체 주택구입·전세자금 대출이자 지원사업 참여자, 유사사업 수혜자(전세피해 임차인 주거비 지원, 청년월세 한시 특별지원 등). 문의 익산시 콜센터 1577-0072 또는 주택과 주거정책계 063-859-5558·5953. 복지로 WLF00006541 ''신혼부부 및 청년 전세자금 대출이자 지원사업''(전북특별자치도 주택건축과, 시군청 주거복지부서 신청)과 같은 구조(연 150만원·3%·중위 180%·3억·85㎡)다 — 도 사업의 익산 시행분으로 보고 도 단위 항목을 따로 두지 않았다. 2025년까지는 ''신혼부부·청년 주택 전세보증금 대출이자''로 묶여 있었고 2026년부터 청년분이 이 사업으로 분리됐다(신혼부부분은 별도 공고, 이 앱 범위 밖). 이 앱은 전세 대출 여부·혼인 여부를 묻지 않아 자격을 자동 판정하지 않는다(정보 제공만). 이자 지원액은 계산하지 않는다.',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 신혼부부 및 청년 공공임대주택 임대보증금 지원 사업 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-public-rental-deposit-support', 2026, null, (select id from public.agencies where name = '전북특별자치도·익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '주택과 주거정책계 (신혼부부 및 청년 공공임대주택 임대보증금 지원 사업)'),
  'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109c55fc84019c87cf06140511', 'https://www.iksan.go.kr/board/post/view.do?boardUid=ff80808199dd1d7d0199e15235920a20&menuUid=ff80808198eafcbd019902aad8302bfa&postUid=4028a6109c55fc84019c87cf06140511', '신혼부부 및 청년 공공임대주택 임대보증금 지원 사업', '대출', '주거비 경감', '운영',
  'LH·전북개발공사가 공급하는 익산시 내 공공임대주택(영구·국민·행복·통합·10년 공공임대, 매입임대 등)에 2026-01-01 이후 계약해 입주했거나 입주 예정인 18~39세 무주택 미혼 청년에게 임대보증금을 무이자로 융자(청년 최대 3천만원, 계약금 10% 이내는 본인 부담). 1회 2년, 청년은 2회 연장해 최장 6년. 연중 선착순 방문 접수(예산 소진 시 종료, 약 44호).',
  null, null, null, null,
  array['52140']::text[], '전북특별자치도 익산시', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

익산시 익산소식 게시글 ''2026년 「신혼부부 및 청년 공공임대주택 임대보증금 지원 사업」 공고''(주택과, 2026-02-23)와 첨부 공고문(익산시 공고 제2026-626호, hwp — Synap 미리보기로 열람) 원문으로 확인(2026-11-03). 사업기간 2026년 2월 ~ 12월(예산 소진 시 종료), 사업규모 약 44호(변동 가능), 신청 ''연중 선착순 수시 접수'' — 세대주 본인 방문(공급주체와 임대차 계약 체결 후), 익산시청 8층 주택과 주거정책계. 지원금액 청년 3천만원·신혼부부 4천만원·신혼부부+1자녀 이상 5천만원(융자). 신규 입주자는 시가 공급주체에 보증금을 직접 지급, 기존 입주 신규신청자는 채권양도 방식. 기존 임대보증금 지원 가구는 중복 신청 불가. 월 임대료·관리비 3개월 이상 미납, 다른 주택 소유 등 입주자격 상실 시 회수 — 전북특별자치도·익산시와 채권 양도·양수 계약을 맺는다. 청년 기준: 18~39세(''87.1.1 ~ ''08.12.31 출생) 미혼. 공고문에 별도 소득 기준은 없다(공공임대 입주 자격을 전제로 함). productType: 현금 지원금이 아니라 공공 재원 무이자 융자라 버팀목·디딤돌(기금 저리대출)과 같은 loan_interest_subsidy 로 분류했다 — 이자 0%·원금은 퇴거 시 회수되는 구조. 이 앱은 공공임대 입주 여부를 묻지 않아 자격을 자동 판정하지 않는다(정보 제공만). 공고문 표기는 ''☎ 859-5549'', 게시글 본문은 ''063-859-5549''.',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 청년 주택드림 디딤돌 대출 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'youth-dream-didimdol-loan', 2026, null, (select id from public.agencies where name = '국토교통부·주택도시기금' and department = ''), (select id from public.agencies where name = '주택도시보증공사(HUG)' and department = '콜센터'),
  'https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030901.jsp', 'https://nhuf.molit.go.kr/FP/FP05/FP0503/FP05030901.jsp', '청년 주택드림 디딤돌 대출', '대출', '자산 형성', '운영',
  '''청년 주택드림 청약통장''으로 청약 당첨(당첨 시 만 39세 이하)된 무주택 세대주가 통장과 연계해 신청하는 주택구입자금 대출. 대출금리 2.4~4.15%(소득·상환기간별 차등), 대출한도 미혼 3억원·신혼 4억원(LTV 70~80%, DTI 60%), 대상주택 전용 85㎡ 이하·평가액 6억원 이하.',
  null, null, null, null,
  array['00']::text[], '전국', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

주택도시기금 공식 페이지(nhuf.molit.go.kr) 원문으로 확인(2026-09-02). 2026-11-03 재대조 — 금리 2.4~4.15%, 한도 미혼 3억원·신혼 4억원(LTV 70%, 생애최초 80%·수도권/규제지역 70%, DTI 60%), 대상주택 전용 85㎡ 이하·평가액 6억원 이하, 순자산 5.11억원 이하가 그대로이고, 소득 기준은 미혼 연 7천만원·신혼 부부합산 연 1억원 이하다. 대출 심사 상담은 ''주택도시보증공사 콜센터 1566-9009 및 기금 수탁은행 지점''(자산심사는 전용 상담센터 1551-3119). 대출 신청은 상품 페이지의 ''대출신청'' 버튼(기금e든든)이나 수탁은행에서 한다 — 온통청년 API 요약(plcyNo 20250514005400110811)과 원문이 일치해 API 값을 그대로 옮겼다(익산·군산 사례와 달리 이번엔 불일치가 없었다). 이 대출은 ''청년 주택드림 청약통장''에 1년 이상 가입 + 1,000만원 이상 납입한 뒤 그 통장으로 청약에 당첨된 사람만 연계 신청할 수 있는 상품이다 — 이 앱은 청약통장 가입·당첨 여부를 입력받지 않으므로 자격을 자동 판정하지 않는다(참고용 안내로만 노출). 대출금리는 소득 구간(2천만원 이하/2~4천만원/4~7천만원/신혼 7~8.5천만원/8.5천만원~1억원)과 상환기간(10/15/20/30년)별로 2.4~4.15%까지 세분화돼 있고, 결혼·출산 우대금리(최대 1%p)까지 있어 실제 적용 금리는 개인마다 다르다 — 이자 절감액은 계산하지 않는다. 자산 기준은 2026년도 순자산 5.11억원 이하.',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 청년 주택드림 청약통장 (apps/web/data/loan-products.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'youth-dream-savings-account', 2026, null, (select id from public.agencies where name = '국토교통부·주택도시기금' and department = ''), (select id from public.agencies where name = '주택도시보증공사(HUG)' and department = '콜센터'),
  'https://nhuf.molit.go.kr/FP/FP07/FP0701/FP07010301.jsp', 'https://nhuf.molit.go.kr/FP/FP07/FP0701/FP07010301.jsp', '청년 주택드림 청약통장', '저축', '자산 형성', '운영',
  '만 19~34세(병역 이행기간 최대 6년 추가 인정) 무주택자, 연소득 5,000만원 이하 청년 대상 주택청약 저축상품. 가입기간 2년 이상~10년 이내 이자율 연 4.5%(그 외 구간은 2.3~3.1%), 청약 당첨 시 청년 주택드림 디딤돌 대출과 연계. 소득공제·비과세 혜택 있음.',
  null, null, null, null,
  array['00']::text[], '전국', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

2026-11-03 재대조 — 가입대상(만 19~34세·병역 최대 6년 인정, 연소득 5천만원 이하, 무주택자)과 가입기간별 이자율(1개월 이내 무이자 ~ 2년 이상 10년 이내 4.5%, 10년 초과 3.1%)이 원문과 그대로다. 가입은 업무취급은행에서 하고 이 페이지에는 은행별 대표번호만 있다 — contact 에는 페이지 하단의 ''포털내용관련 주택도시보증공사 1566-9009''를 넣었다(은행 상품 가입 문의는 각 은행). 주택도시기금 공식 페이지(nhuf.molit.go.kr, 상품기준일 2026-06-30) 원문으로 확인(조회 2026-09-02). 이자율은 가입기간별로 다르다 — 1개월 이내 무이자, 1개월~1년 미만 연 2.3%(청약당첨 해지 시 3.7%), 1년~2년 미만 연 2.8%(당첨해지 시 4.2%), 2년~10년 이내 연 4.5%, 10년 초과 연 3.1%. ⚠️ 온통청년 API(plcyNo 20260616005400113238)의 ''월 납입한도 100만원'', ''소득공제 연 300만원 한도 40%''는 이 공식 페이지에서 직접 재확인하지 못했다(페이지는 소득공제를 ''기존 주택청약종합저축과 동일''이라고만 언급) — API 값을 notes 밖 요약엔 안 옮기고 확인 필요로 남긴다. 이 상품 자체는 저축이라 지원금이 없다 — 청약 당첨 시 연계되는 대출(청년 주택드림 디딤돌 대출, youth-dream-didimdol-loan)의 이자만 실제 혜택에 해당하고 그것도 개인별 조건에 따라 달라 계산하지 않는다.',
  'seed 이관(JSON 원본)',
  'apps/web/data/loan-products.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 대학생 연합생활관(은행권,고양) (apps/web/data/housing-supply.json)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'kosaf-goyang-dormitory', 2026, null, (select id from public.agencies where name = '교육부·한국장학재단 청년주거지원부' and department = ''), (select id from public.agencies where name = '한국장학재단' and department = '대학생 연합생활관(고양)'),
  'https://www.kosaf.go.kr/ko/notice.do?mode=view&searchStr=&searchType=&page=1&ctgrId1=0000000009&ctgrId2=&seqNo=20960', 'https://www.kosaf.go.kr/ko/notice.do?mode=list&searchType=title&searchStr=%EC%97%B0%ED%95%A9%EC%83%9D%ED%99%9C%EA%B4%80&ctgrId1=0000000009', '대학생 연합생활관(은행권,고양)', '임대', '주택 공급', '운영',
  '경기도 고양시 원흥역 인근 대학생 연합생활관. 전국 대학(원)생(입학예정 포함, 외국인 포함) 대상, 월 15만원(6개월 생활관비 90만원)·보증금 15만원. 2026년 신규 입주 신청은 1학기 2026-01-19~01-30, 2학기 2026-07-27~08-10이었고, 공실이 생기면 수시모집 공고가 따로 올라온다.',
  null, null, null, null,
  array['00']::text[], '전국', null,
  null, null, null,
  null, null, null,
  null, null, null, null,
  '[seed] JSON 에 조건값(나이·상태·소득·주거)이 구조화돼 있지 않아 비워 뒀다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로, 주거 칸이 비면 ''계약 형태 무관''으로 읽는다. 원문 대조 때 채울 것.

[JSON 기타 칸] {"location":"경기도 고양시 덕양구 원흥1로 23","deposit":150000,"monthlyRentMin":150000,"monthlyRentMax":150000,"capacityLabel":"정원 미확인(2026년 공고에 정원 표기 없음)","applicationPeriodNote":"학기별 정기모집(1학기는 1월, 2학기는 7~8월 신청) + 공실 발생 시 수시모집. 가장 최근 신규 모집인 2026년 2학기(3차)는 2026-07-27~08-10 신청, 거주기간 2026-08-27~2027-02-15로 이미 종료됐다(오늘 2026-11-03 기준). 2027년 1학기 모집 공고는 아직 올라오지 않았다(2026년 1학기 신규 모집 공고는 2025-12-19 게시) — 한국장학재단 공지사항에서 확인해야 한다."}

2026-11-03 재대조: 최신 공고 ''2026년 2학기 신규 입주자 모집 공고(2026년 2학기 3차)''(작성일 2026-06-16)와 첨부 hwpx 원문 — 납부금액 1,050,000원(6개월 생활관비 900,000원 + 보증금 150,000원) 그대로, 신청대상 동일, 문의 ''한국장학재단 대학생 연합생활관(고양) ☎031-920-7200''. 2026년 2학기부터 1인실 신청이 추가됐다(1인실 요금·정원은 이 공고에 없다). ⚠️ capacityLabel 에 있던 ''986명(2인 1실)''은 2026년 공고 원문에서 확인되지 않아(정원 표기 없음) ''정원 미확인''으로 바꿨다 — 확인목록 참고. 신청은 로그인 후 ''기숙사 > 마이페이지 > 입주신청''이라 고정 주소가 없어 applyUrl 을 연합생활관 공고 목록으로 바꿨다. 이하 이전 기록: 한국장학재단 공지사항 ''2026년 1학기 신규 입주자 모집 공고(2026년 1학기 2차)''(작성일 2025-12-19) 원문으로 확인(조회 2026-09-02) — 납부금액 1,050,000원(6개월 생활관비 900,000원 + 보증금 150,000원, 월 환산 15만원)이 온통청년 API의 ''월 15만원(보증금 15만원)''과 정확히 일치했다. 신청대상: 「고등교육법」상 대학·산업대학·교육대학·전문대학·각종학교·대학원(원격·사이버대학원 제외) 등에 입학예정 또는 재적 중인 대학(원)생. 이 공고 자체(2026년 1학기 2차)는 이미 마감됐다. ⚠️ 정기모집이 학기마다 반복되는 구조라 applicationStart/End 를 특정 회차로 고정하지 않고 applicationPeriodNote 에 주기를 적었다 — 단일 신청기간이 있는 청춘★별채와 다르다. 문의: 한국장학재단 대학생 연합생활관(고양) 031-920-7200.',
  'seed 이관(JSON 원본)',
  'apps/web/data/housing-supply.json 이관 (데이터 커밋 6891fb9). 값은 ggue 가 2026-11-03 원문 재대조 때 고친 것(verifiedAt 2026-11-03) — ggue 본인 확인이라 검수 기록으로는 넣지 않았다. 원문 위치는 source_url·notes.'
);
-- 전입세대 전입장려금 (새 후보 · 보류)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-move-in-household-incentive', 2026, (select id from public.policy_raw where kind = '보조금24API' and external_id = '468100000001'), (select id from public.agencies where name = '익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '기획예산과'),
  'https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2128388&bnefType=all&svcId=468100000001', 'https://www.iksan.go.kr/reserve/index.iksan', '전입세대 전입장려금', '현금', '이주·정착', '보류',
  '전입 6개월 이상 경과 시 1명당 10만원 시 지역화폐 다이로움 지급',
  null, null, null, null,
  array['52140']::text[], '전북특별자치도 익산시', null,
  null, null, null,
  'lump_sum'::public.opt_benefit_type, null, null,
  null, 'notCalculable', null, null,
  '[seed 초안] 보조금24 API 응답(policy_raw, seed/raw/gov24-468100000001.json)에서 옮겼다. 익산시 원문(조례·공고) 대조 전 — 확인 필요.
지원 형태 ''현금''은 보조금24 지원유형 값 그대로다. DB 규칙상 현금은 계산 방식을 골라야 해서 lump_sum + notCalculable(계산 안 함)로 두고 금액은 비웠다.
조건 칸(나이·상태·소득)은 비웠다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로 읽는다.
보조금24 지원대상: 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 세대 및 세대원 ※ 전입 6개월 이상 경과 시 신청가능  ※ 주소전입 학생 지원과 중복 불가 ※ 재전입자 중 기 지원받은 사실이 있는 경우 지원 불가
보조금24 지원내용: ○ 지원대상 : 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 관내로 전입한 세대 및 세대원 ○ 지원내용 : 전입 6개월 이상 경과 시 1명당 10만원 시 지역화폐 다이로움 지급    ※ 재전입자 중 기 지원받은 사실이 있는 경우 지원 불가     ※ 주소전입 학생 지원사업과 중복 지원 불가 ○ 신청시기 : 전입 6개월 이상 경과 후 신청  ○ 신청기한 : 신청가능일로부터 1년이내  ○ 지원시기 : 신청 익월 15일 전후 지급
근거 자치법규: 익산시 인구증가시책 지원 조례(제6조) · 신청기한: 상시신청 · 보조금24 수정일시: 2026-08-11',
  'seed 초안(보조금24 원문)',
  '보조금24 API(서비스ID 468100000001, 2026-11-12 조회) 응답에서 옮긴 초안. 익산시 원문 확인 전이라 상태는 ''보류''.'
);
-- 주소전입 학생 지원 (새 후보 · 보류)
insert into public.policies (
  policy_no, year, raw_id, agency_id, contact_id, source_url, apply_url, name, kind, purpose, status, summary,
  apply_start, apply_end, age_min, age_max, region_codes, region_label, statuses,
  income_bracket_min, income_bracket_max, housing_types,
  benefit_type, monthly_cap, max_months, lump_sum_cap, lump_sum_basis, exclusive_groups, required_inputs,
  notes, edited_by, edit_note
) values (
  'iksan-move-in-student-support', 2026, (select id from public.policy_raw where kind = '보조금24API' and external_id = '468100000005'), (select id from public.agencies where name = '익산시' and department = ''), (select id from public.agencies where name = '익산시' and department = '기획예산과 (주소전입 학생 지원)'),
  'https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/benefitSrvcDtl?svcSeq=2167917&bnefType=all&svcId=468100000005', 'https://www.iksan.go.kr/reserve/index.iksan', '주소전입 학생 지원', '현금', '이주·정착', '보류',
  '최초학기 30만원, 이후 학기별 10만원 지급',
  null, null, null, null,
  array['52140']::text[], '전북특별자치도 익산시', null,
  null, null, null,
  'lump_sum'::public.opt_benefit_type, null, null,
  null, 'notCalculable', null, null,
  '[seed 초안] 보조금24 API 응답(policy_raw, seed/raw/gov24-468100000005.json)에서 옮겼다. 익산시 원문(조례·공고) 대조 전 — 확인 필요.
지원 형태 ''현금''은 보조금24 지원유형 값 그대로다. DB 규칙상 현금은 계산 방식을 골라야 해서 lump_sum + notCalculable(계산 안 함)로 두고 금액은 비웠다.
조건 칸(나이·상태·소득)은 비웠다 — 확인 필요. 나이 칸이 둘 다 비면 DB 는 ''나이 제한 없음''으로 읽는다.
보조금24 지원대상: ○ 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 익산시로 전입한 익산시 소재 고등학교 및 대학교(원) 재학생
보조금24 지원내용: ○ 지원대상 : 전입신고일 기준 1년 이전부터 타 시군구에 주민등록을 두고 있다가 익산시로 전입한 익산시 소재 고등학교 및 대학교(원) 재학생 ○ 지원내용 : 최초학기 30만원, 이후 학기별 10만원 지급    - 고등학생 : 최대 80만원, 대학(원)생 최대 100만원    ※ 전입세대 전입장려금과 중복지원 불가    ※ 지원대상자가 지원금액 지급일 현재까지 계속하여 익산시에 주소를 두어야 함  ○ 신청기간 : 전입일로부터 1년 이내 신청 가능
근거 자치법규: 익산시 인구증가시책 지원 조례(제6조) · 신청기한: 상시신청 · 보조금24 수정일시: 2026-08-11',
  'seed 초안(보조금24 원문)',
  '보조금24 API(서비스ID 468100000005, 2026-11-12 조회) 응답에서 옮긴 초안. 익산시 원문 확인 전이라 상태는 ''보류''.'
);

-- 마지막 확인: 넣은 개수가 맞지 않으면 전부 취소
do $$
begin
  if (select count(*) from public.policies) <> 16
     or (select count(*) from public.policies where status = '보류') <> 2
     or (select count(*) from public.agencies) <> 23
     or (select count(*) from public.policy_raw) <> 2 then
    raise exception '적재_개수_불일치';
  end if;
end $$;

commit;
