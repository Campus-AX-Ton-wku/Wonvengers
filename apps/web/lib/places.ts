/**
 * 서류 떼는 곳 지도의 장소 (docs/기획/2026-11-22-서류-떼는-곳-지도-설계.md).
 *
 * 데이터는 빌드 때 scripts/fetch-civil-places.mjs 가 data/civil-places.json 으로 만든다 — 화면은 그 파일만 읽는다.
 * 무인민원발급기: 행정안전부 무인민원발급기정보 조회서비스 · 주민센터: 카카오 장소 검색. 없는 값은 null 로 둔다(F0-5).
 */

export type PlaceKind = "office" | "kiosk";

/** 무인민원발급기 API 의 서류 이름(CVLCPT_OFCWORK_CLSF_NM) → 화면 이름. 가이드 1장의 서류와 같은 이름을 쓴다 */
export const KIOSK_DOCS = [
  { key: "resident", api: "주민등록표(등본)", label: "주민등록등본" },
  { key: "family", api: "가족관계증명서", label: "가족관계증명서" },
  { key: "health", api: "건강보험 자격득실확인서", label: "건강보험 자격득실확인서" },
  { key: "income", api: "소득금액증명", label: "소득금액증명" },
  { key: "building", api: "건축물대장", label: "건축물대장" },
  { key: "registry", api: "부동산등기사항증명서", label: "등기부등본" },
] as const;

export type KioskDocKey = (typeof KIOSK_DOCS)[number]["key"];

export interface CivilPlace {
  id: string;
  kind: PlaceKind;
  name: string;
  address: string;
  /** 설치 장소 상세 (발급기) */
  detail: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  /** 평일 운영시간 (발급기). 데이터에 없으면 null */
  weekday: string | null;
  /** 공휴일 운영시간 (발급기). 데이터에 없으면 null — '운영 안 함'으로 읽지 않는다 */
  holiday: string | null;
  /** 운영시간 참고 (발급기) */
  hoursNote: string | null;
  /** 뗄 수 있는 서류 (발급기만, 우리 서류 6개 중) */
  documents: KioskDocKey[];
}

export interface CivilPlacesSnapshot {
  generatedAt: string | null;
  places: CivilPlace[];
}

export function filterPlaces(
  places: CivilPlace[],
  { kind, doc }: { kind: "all" | PlaceKind; doc: KioskDocKey | null }
): CivilPlace[] {
  return places.filter((p) => {
    if (kind !== "all" && p.kind !== kind) return false;
    if (doc && !p.documents.includes(doc)) return false;
    return true;
  });
}

/** 두 지점 사이 직선거리(km), 하버사인 */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 내 위치가 '익산 안'이라고 볼 거리(km). 이보다 멀면 지도를 내 위치로 옮기지 않는다 */
export const NEAR_KM = 30;

/** 내 위치에서 km 안에 있는 장소가 하나라도 있는지 */
export function isNearAny(me: { lat: number; lng: number }, places: CivilPlace[], km: number): boolean {
  return places.some((p) => distanceKm(me, p) <= km);
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/** 카카오맵 길찾기(목적지만 정해 둔 링크). 출발지는 카카오맵이 묻는다 */
export function directionsUrl(p: CivilPlace): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
}

/** 지도에서 한 장소만 보일 때 거리 확대를 막는 가장 작은 지도 단계 (카카오: 숫자가 작을수록 가까이 확대) */
export const MIN_MAP_LEVEL = 4;

/** 익산 시내(동 지역)인지 — 주소에 읍 · 면이 없으면 시내로 본다. 처음 지도 화면을 시내에 맞추는 데 쓴다 */
export function isCityCenter(p: CivilPlace): boolean {
  return !/(읍|면) /.test(p.address);
}

/** 검색어 비교용 — 앞뒤 · 가운데 공백을 모두 없애고 소문자로 */
export function normalizeQuery(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

const OFFICE_WORDS = ["주민센터", "행정복지센터"];
const KIOSK_WORD = "무인민원발급기";

/** 이름 · 주소 · 설치 장소 상세에 검색어가 있거나, 종류 이름(주민센터 · 발급기 …)을 쓴 검색어인지 */
export function matchesQuery(p: CivilPlace, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  if ([p.name, p.address, p.detail ?? ""].some((v) => normalizeQuery(v).includes(q))) return true;
  if (q.length >= 2) {
    if (p.kind === "office" && OFFICE_WORDS.some((w) => w.includes(q))) return true;
    if (p.kind === "kiosk" && KIOSK_WORD.includes(q)) return true;
  }
  return false;
}
