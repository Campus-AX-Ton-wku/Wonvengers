// 서류 떼는 곳 지도 — API 응답을 장소로 바꾸는 순수 함수 (docs/기획/2026-11-22-서류-떼는-곳-지도-설계.md).
// 네트워크는 fetch-civil-places.mjs 가 맡고, 여기는 값만 다룬다 — 테스트가 실제 응답 모양으로 검사한다.

/** 익산 읍면동 (1읍 14면 14동). 주민센터 검색에 쓴다 */
export const IKSAN_EMD = [
  "함열읍", "함라면", "웅포면", "성당면", "용안면", "낭산면", "망성면", "여산면", "금마면", "왕궁면",
  "춘포면", "삼기면", "용동면", "오산면", "황등면",
  "인화동", "동산동", "마동", "남중동", "모현동", "송학동", "중앙동", "평화동", "신동", "영등1동",
  "영등2동", "어양동", "팔봉동", "삼성동",
];

/** 행정안전부 무인민원발급기 API 의 익산 개방자치단체코드 · 전북 시도코드 (11/22 실제 응답) */
export const IKSAN_GROUP_CD = "4681000";
export const JEONBUK_CTPV_CD = "6540000";

/** lib/places.ts KIOSK_DOCS 의 key · api (테스트가 같은지 본다) */
export const KIOSK_DOCS = [
  { key: "resident", api: "주민등록표(등본)" },
  { key: "family", api: "가족관계증명서" },
  { key: "health", api: "건강보험 자격득실확인서" },
  { key: "income", api: "소득금액증명" },
  { key: "building", api: "건축물대장" },
  { key: "registry", api: "부동산등기사항증명서" },
];

const squash = (s) => s.replace(/\s+/g, "");

/** 카카오 키워드 검색 결과 중 그 읍면동 주민센터. 없으면 null — 지어내지 않는다 */
export function pickOffice(emd, docs) {
  return (
    docs.find((d) => {
      const name = squash(d.place_name).replace(/^익산시?/, "");
      return (
        name.startsWith(emd) &&
        /행정복지센터|주민센터/.test(name) &&
        d.category_group_code === "PO3" &&
        d.address_name.includes("익산")
      );
    }) ?? null
  );
}

export function toOffice(emd, d) {
  return {
    id: `office-${emd}`,
    kind: "office",
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    detail: null,
    phone: d.phone || null,
    lat: Number(d.y),
    lng: Number(d.x),
    weekday: null,
    holiday: null,
    hoursNote: null,
    documents: [],
  };
}

/** 주소 → 카카오 주소 검색어. 지번 [..] · 쉼표 뒤 건물명 · 끝 (동) 을 뗀다 */
export function geocodeQuery(addr) {
  return addr.split("[")[0].split(",")[0].replace(/\([^)]*\)\s*$/, "").trim();
}

function hours(begin, end) {
  const b = (begin ?? "").trim();
  const e = (end ?? "").trim() === "2400" ? "24:00" : (end ?? "").trim();
  if (!b || !e) return null;
  if (b === "00:00" && e === "24:00") return "24시간";
  return `${b}~${e}`;
}

/**
 * 설치정보 + 발급제증명 → 발급기 장소. 익산 · 사용 중 · 좌표가 있는 것만.
 * coords: MNG_NO → 좌표 (fetch 스크립트가 카카오 주소 검색으로 채운다)
 */
export function toKiosks(installRows, certRows, coords) {
  const docsByNo = new Map();
  for (const c of certRows) {
    const doc = KIOSK_DOCS.find((d) => d.api === c.CVLCPT_OFCWORK_CLSF_NM);
    if (!doc) continue;
    if (!docsByNo.has(c.ISSUMCHN_NO)) docsByNo.set(c.ISSUMCHN_NO, new Set());
    docsByNo.get(c.ISSUMCHN_NO).add(doc.key);
  }
  const places = [];
  const skipped = [];
  for (const r of installRows) {
    if (r.OPN_ATMY_GRP_CD !== IKSAN_GROUP_CD || r.USE_YN_NM !== "사용") continue;
    const at = coords.get(r.MNG_NO);
    if (!at) {
      skipped.push(`${r.MNG_NO} ${r.ISSUMCHN_NM} — 좌표를 못 찾음`);
      continue;
    }
    const have = docsByNo.get(r.MNG_NO) ?? new Set();
    places.push({
      id: `kiosk-${r.MNG_NO}`,
      kind: "kiosk",
      name: r.ISSUMCHN_NM,
      address: geocodeQuery(r.INSTL_PLC_ADDR),
      detail: r.INSTL_PLC_DTL_PSTN?.trim() || null,
      phone: null,
      lat: at.lat,
      lng: at.lng,
      weekday: hours(r.WKDY_OPER_BGNG_TM, r.WKDY_OPER_END_TM),
      holiday: hours(r.LHLDY_OPER_BGNG_TM, r.LHLDY_OPER_END_TM),
      hoursNote: r.OPER_HR_REF_CN?.trim() || null,
      documents: KIOSK_DOCS.filter((d) => have.has(d.key)).map((d) => d.key),
    });
  }
  return { places, skipped };
}

export function formatSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
