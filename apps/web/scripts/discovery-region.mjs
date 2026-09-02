/**
 * 온통청년 정책의 등록기관명(rgtrInstCdNm)으로 전국·광역·시군구를 가른다.
 *
 * 예전엔 zipCd 개수(200개 이상 = 전국)로 판별했는데 신뢰할 수 없음이 실측으로
 * 드러났다 — "강원형 공공주택 공급"(강원특별자치도 전용 사업)이 zipCd 251개로
 * 진짜 전국 사업과 똑같이 잡혔다. 의성군 사업 여럿도 같은 방식으로 전국에
 * 섞여 들어왔다. zipCd 필드 자체가 등록 단계에서부터 신뢰할 수 없다
 * (docs/온통청년-API-연동.md 에 이미 기록된 문제의 연장선).
 *
 * 등록기관명은 짐작하지 않고 온통청년 대분류 `주거` 282건 전수를 조회해 실제
 * 값 75종을 전부 확인한 뒤 이 규칙을 만들었다.
 */

/**
 * 17개 광역시도 정식명. 실제 데이터에 한 번도 안 나온 이름(대전광역시 등)도
 * 앞으로 나올 수 있어 그대로 둔다 — 짐작이 아니라 행정구역 목록 자체는 고정값이다.
 *
 * "전남광주통합특별시"는 정식 17개 목록에 없지만 실제 rgtrInstCdNm 값으로
 * 존재한다 — 같은 데이터 안에 "전라남도 강진군 인구정책과"와
 * "전남광주통합특별시 강진군 인구정책과"가 나란히 등록돼 있다(전남·광주 통합이
 * 이 앱의 시점엔 행정구역에 반영된 것으로 보인다). 짐작하지 않고 실제 값을
 * 그대로 광역명 목록에 추가했다.
 */
export const PROVINCE_NAMES = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
  "전남광주통합특별시",
];

/**
 * 표기 흔들림. "광주시청"이 "광주광역시"의 다른 표기임을 실제 데이터에서
 * 확인했다(같은 데이터 안에 "광주광역시"도 독립된 값으로 존재한다).
 */
const AGENCY_ALIASES = {
  광주시청: "광주광역시",
};

function normalizeAgencyName(name) {
  const trimmed = (name ?? "").trim();
  return AGENCY_ALIASES[trimmed] ?? trimmed;
}

/**
 * 등록기관명 하나를 전국(national) · 광역(province) · 시군구(city) 로 가른다.
 *
 * 규칙:
 *  1. 이름이 광역명 어느 것으로도 시작하지 않으면 전국(중앙부처·산하기관 등).
 *     "청년정책관"처럼 소속을 알 수 없는 이름도 여기 떨어진다 — 추정하지
 *     않고 기본값에 맡긴다.
 *  2. 광역명을 뗀 나머지의 첫 단어가 '시'·'군'·'구'로 끝나면 시군구다(그 이름을
 *     함께 돌려준다). 부서명(국·과·실·단·청·원·관·수 등)은 이 어미로 끝나지
 *     않는다 — 282건 전수를 확인해 부서명과 시군구명이 이 규칙으로 갈린다는
 *     것을 검증했다(예: "관광복지국"은 국으로 끝나 부서, "의성군"은 군으로
 *     끝나 시군구).
 *  3. 나머지가 없거나 부서명뿐이면 광역 그 자체(그 광역의 자체 부서·산하기관).
 */
export function classifyAgency(rawName) {
  const name = normalizeAgencyName(rawName);
  const province = PROVINCE_NAMES.find((p) => name.startsWith(p));
  if (!province) return { scope: "national", province: null, city: null };

  const rest = name.slice(province.length).trim();
  const firstWord = rest.split(/\s+/)[0] ?? "";
  if (/[시군구]$/.test(firstWord)) {
    return { scope: "city", province, city: firstWord };
  }
  return { scope: "province", province, city: null };
}
