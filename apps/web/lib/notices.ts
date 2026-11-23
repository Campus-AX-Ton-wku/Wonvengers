/**
 * 익산 청약 공고 (docs/기획/2026-11-22-청약-공고-설계.md). 빌드 때 scripts/fetch-notices.mjs 가 data/notices.json 으로 굽는다.
 * 알림 서버(apps/api)도 이 파일을 가져다 쓴다 — '@/' 경로를 쓰지 않는다.
 * 자격은 판정하지 않는다(공고마다 달라 원문 링크와 기간만 — F0-5).
 */

export type NoticeKind = "공공임대" | "공공분양" | "아파트 분양" | "무순위 · 잔여";

export interface HousingNotice {
  /** myhome:{pblancId} · applyhome:{HOUSE_MANAGE_NO}-{PBLANC_NO} */
  id: string;
  source: "마이홈포털" | "청약홈";
  kind: NoticeKind;
  /** 배지 — 임대는 행복주택 · 국민임대 …, 그 밖은 kind */
  typeLabel: string;
  title: string;
  supplier: string | null;
  /** 모집공고일 YYYY-MM-DD */
  announcedAt: string | null;
  applyStart: string | null;
  applyEnd: string | null;
  /** 원문 공고 */
  url: string;
  address: string | null;
}

export interface NoticeSnapshot {
  /** 받은 시각(서울, ISO). 아직 한 번도 못 받았으면 null */
  generatedAt: string | null;
  notices: HousingNotice[];
}

export const NOTICE_KINDS: NoticeKind[] = ["공공임대", "공공분양", "아파트 분양", "무순위 · 잔여"];

/** 공고를 알릴 사는 곳 — 알림함 · 휴대폰 알림 모두 이 지역에 사는(답한) 사람에게만 */
export const NOTICE_REGION = "전북특별자치도 익산시";

export type NoticeStatus = "open" | "upcoming" | "ended";

export function noticeStatus(n: HousingNotice, today: string): NoticeStatus {
  if (n.applyEnd && n.applyEnd < today) return "ended";
  if (n.applyStart && today < n.applyStart) return "upcoming";
  return "open";
}

const byEnd = (a: HousingNotice, b: HousingNotice) => (a.applyEnd ?? "9999-12-31").localeCompare(b.applyEnd ?? "9999-12-31");
const byStart = (a: HousingNotice, b: HousingNotice) => (a.applyStart ?? "").localeCompare(b.applyStart ?? "");

/** 접수 중(마감 가까운 순) · 접수 예정(시작 가까운 순). 끝난 공고는 뺀다 — 스냅숏이 하루 늦을 수 있다. */
export function groupNotices(notices: readonly HousingNotice[], today: string, kind: NoticeKind | null = null) {
  const list = kind ? notices.filter((x) => x.kind === kind) : [...notices];
  return {
    open: list.filter((x) => noticeStatus(x, today) === "open").sort(byEnd),
    upcoming: list.filter((x) => noticeStatus(x, today) === "upcoming").sort(byStart),
  };
}

export function kindsPresent(notices: readonly HousingNotice[], today: string): NoticeKind[] {
  const live = new Set(notices.filter((x) => noticeStatus(x, today) !== "ended").map((x) => x.kind));
  return NOTICE_KINDS.filter((k) => live.has(k));
}

const DAY = 86_400_000;

/** components/DeadlineBadge 가 아는 말(lib/preparation.ts deadlineLabel 과 같은 말) */
export function noticeDeadlineLabel(n: HousingNotice, today: string): string {
  if (noticeStatus(n, today) === "upcoming") return "신청 예정";
  if (n.applyEnd === null) return "상시";
  const days = Math.round((Date.parse(n.applyEnd) - Date.parse(today)) / DAY);
  return days === 0 ? "오늘 마감" : `D-${days}`;
}

export function homeNotices(notices: readonly HousingNotice[], today: string): HousingNotice[] {
  const { open, upcoming } = groupNotices(notices, today);
  return [...open, ...upcoming].slice(0, 3);
}

export function snapshotDateLabel(generatedAt: string | null): string | null {
  if (!generatedAt) return null;
  const [, m, d] = generatedAt.slice(0, 10).split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}
