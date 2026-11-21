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

/**
 * 카카오 키워드 검색 결과 중 그 읍면동 주민센터. 없으면 null — 지어내지 않는다.
 * 이름은 공백을 빼고 앞의 '익산(시)'을 뗀 뒤, 정확히 '{읍면동}행정복지센터' 또는 '{읍면동}주민센터'여야 한다
 * (별관 · 민원실 같은 하위 장소, 영등1동 vs 영등2동 를 거른다).
 */
export function pickOffice(emd, docs) {
  const named = new RegExp(`^${emd}(행정복지센터|주민센터)$`);
  return (
    docs.find((d) => {
      const name = squash(d.place_name).replace(/^익산시?/, "");
      return named.test(name) && d.category_group_code === "PO3" && d.address_name.includes("익산시");
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

/**
 * 받은 결과로 스냅숏을 덮어쓸지. 부분 실패(발급기 API 가 빔 · 카카오 일부 실패)로
 * 멀쩡한 스냅숏을 줄이지 않는다 — 커밋된 곳 수의 80% 아래면 쓰지 않는다.
 */
export function decideWrite({ offices, kiosks, committedCount }) {
  if (offices === 0) return { write: false, reason: "주민센터가 0곳" };
  if (kiosks === 0) return { write: false, reason: "발급기가 0대" };
  const min = Math.ceil(committedCount * 0.8);
  if (committedCount > 0 && offices + kiosks < min) {
    return { write: false, reason: `${offices + kiosks}곳은 커밋된 ${committedCount}곳의 80%(${min}곳) 미만` };
  }
  return { write: true, reason: "ok" };
}

/** data.go.kr totalCount 가 쓸 만한 값(양의 유한수)이면 그 수, 아니면 null (null · "" · 문자 · 0 은 모름) */
export function usableTotal(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
