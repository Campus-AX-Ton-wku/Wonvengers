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

/** API 운영시간 두 칸 → 한 줄. '2400' 은 24:00, 00:00~24:00 은 24시간. 한쪽이라도 비면 null */
export function formatHours(begin: string, end: string): string | null {
  const b = begin.trim();
  const e = end.trim() === "2400" ? "24:00" : end.trim();
  if (!b || !e) return null;
  if (b === "00:00" && e === "24:00") return "24시간";
  return `${b}~${e}`;
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

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/** 카카오맵 길찾기(목적지만 정해 둔 링크). 출발지는 카카오맵이 묻는다 */
export function directionsUrl(p: CivilPlace): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
}
