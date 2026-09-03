import type { PolicyMeta } from "./types";

/** 정책 데이터와 화면이 함께 쓰는 시·군·구 한 항목. */
export interface RegionOption {
  /** `시도 시군구` 정식명. 정책의 regionScope와 같은 어휘를 쓴다. */
  value: string;
  /** 다른 화면의 select에서도 뜻이 분명하도록 정식명을 표시한다. */
  label: string;
  /** 답변 요약에 쓰는 짧은 이름. */
  chipLabel: string;
}

/** Find에서 먼저 고르는 시·도와, 그 다음에 보여줄 시·군·구 목록. */
export interface RegionProvince {
  name: string;
  chipLabel: string;
  districts: readonly RegionOption[];
}

function districts(province: string, names: readonly string[]): RegionOption[] {
  return names.map((name) => ({
    value: `${province} ${name}`,
    label: `${province} ${name}`,
    chipLabel: name,
  }));
}

/**
 * 2026-09-03 기준 대한민국 17개 시·도와 시·군·구.
 *
 * Find에서 전국 시군구를 한 화면에 늘어놓지 않고 이 구조의 시도부터 고른다.
 * 인천은 2026-07-01 개편 이후 명칭(제물포구·영종구·서해구·검단구)을 쓴다.
 * 세종은 기초자치단체가 없어서 `세종특별자치시 전체` 한 항목으로 한 번 더
 * 확인받는다. 제주의 제주·서귀포는 행정시지만 거주 지역 선택에는 필요하다.
 */
export const REGION_HIERARCHY: readonly RegionProvince[] = [
  {
    name: "서울특별시",
    chipLabel: "서울",
    districts: districts("서울특별시", [
      "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
      "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구",
      "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구",
    ]),
  },
  {
    name: "부산광역시",
    chipLabel: "부산",
    districts: districts("부산광역시", [
      "중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구",
      "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군",
    ]),
  },
  {
    name: "대구광역시",
    chipLabel: "대구",
    districts: districts("대구광역시", [
      "중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군",
    ]),
  },
  {
    name: "인천광역시",
    chipLabel: "인천",
    districts: districts("인천광역시", [
      "제물포구", "영종구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서해구",
      "검단구", "강화군", "옹진군",
    ]),
  },
  {
    name: "광주광역시",
    chipLabel: "광주",
    districts: districts("광주광역시", ["동구", "서구", "남구", "북구", "광산구"]),
  },
  {
    name: "대전광역시",
    chipLabel: "대전",
    districts: districts("대전광역시", ["동구", "중구", "서구", "유성구", "대덕구"]),
  },
  {
    name: "울산광역시",
    chipLabel: "울산",
    districts: districts("울산광역시", ["중구", "남구", "동구", "북구", "울주군"]),
  },
  {
    name: "세종특별자치시",
    chipLabel: "세종",
    districts: [
      { value: "세종특별자치시", label: "세종특별자치시 전체", chipLabel: "세종" },
    ],
  },
  {
    name: "경기도",
    chipLabel: "경기",
    districts: districts("경기도", [
      "수원시", "용인시", "고양시", "화성시", "성남시", "부천시", "남양주시", "안산시",
      "평택시", "안양시", "시흥시", "파주시", "김포시", "의정부시", "광주시", "하남시",
      "광명시", "군포시", "양주시", "오산시", "이천시", "안성시", "구리시", "의왕시",
      "포천시", "여주시", "동두천시", "과천시", "가평군", "양평군", "연천군",
    ]),
  },
  {
    name: "강원특별자치도",
    chipLabel: "강원",
    districts: districts("강원특별자치도", [
      "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군",
      "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군",
    ]),
  },
  {
    name: "충청북도",
    chipLabel: "충북",
    districts: districts("충청북도", [
      "청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군",
    ]),
  },
  {
    name: "충청남도",
    chipLabel: "충남",
    districts: districts("충청남도", [
      "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "금산군",
      "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군",
    ]),
  },
  {
    name: "전북특별자치도",
    chipLabel: "전북",
    districts: districts("전북특별자치도", [
      "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군",
      "장수군", "임실군", "순창군", "고창군", "부안군",
    ]),
  },
  {
    name: "전라남도",
    chipLabel: "전남",
    districts: districts("전라남도", [
      "목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군",
      "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군",
      "장성군", "완도군", "진도군", "신안군",
    ]),
  },
  {
    name: "경상북도",
    chipLabel: "경북",
    districts: districts("경상북도", [
      "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시",
      "경산시", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군",
      "예천군", "봉화군", "울진군", "울릉군",
    ]),
  },
  {
    name: "경상남도",
    chipLabel: "경남",
    districts: districts("경상남도", [
      "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군",
      "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군",
    ]),
  },
  {
    name: "제주특별자치도",
    chipLabel: "제주",
    districts: districts("제주특별자치도", ["제주시", "서귀포시"]),
  },
] as const;

/** 판정·요약·계약 입력 화면이 소비하는 평탄화 목록. */
export const REGION_OPTIONS: readonly RegionOption[] = REGION_HIERARCHY.flatMap(
  (province) => province.districts
);

export type RegionValue = (typeof REGION_OPTIONS)[number]["value"];

export function isRegionValue(value: string): value is RegionValue {
  return REGION_OPTIONS.some((option) => option.value === value);
}

/** 저장된 시군구 값이 어느 시도에 속하는지 찾는다. */
export function provinceForRegion(value: string | null): RegionProvince | null {
  if (!value) return null;
  return REGION_HIERARCHY.find((province) =>
    province.districts.some((district) => district.value === value)
  ) ?? null;
}

const strip = (s: string) => s.replace(/\s/g, "");

/** 정책의 regionScope가 사용자의 시군구에 적용되는가. */
export function policyAppliesToRegion(regionScope: string, region: string): boolean {
  if (regionScope === "전국") return true;
  if (!region) return false;
  // 시군구 사용자는 소속 시도 정책도 받는다.
  return strip(region).startsWith(strip(regionScope));
}

/** 사용자 지역에 해당하는 정책만 남긴다. 여기서 빠진 정책의 질문은 아예 묻지 않는다. */
export function policiesForRegion(policies: PolicyMeta[], region: string): PolicyMeta[] {
  return policies.filter((policy) => policyAppliesToRegion(policy.regionScope, region));
}
