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
