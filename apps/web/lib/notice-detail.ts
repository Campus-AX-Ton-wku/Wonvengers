/**
 * 청약 공고 상세 (docs/기획/2026-11-22-청약-공고-설계.md §7). scripts/notices/build.mjs 가 굽는다.
 * 알림 서버가 쓰는 lib/notices.ts 와 따로 둔다 — 화면만 바꾸는데 'AWS 배포'가 걸리지 않게.
 */
import type { HousingNotice } from "./notices";

export interface NoticeComplex {
  name: string;
  address: string | null;
  /** 공급 N호, 0(잔여 매각) 이면 null */
  households: number | null;
  heating: string | null;
  /** 원. 마이홈 값은 모두 '가장 낮은 조건'(11/23 공고문 대조) */
  amounts: { label: string; won: number }[];
}

export interface NoticeHouseType {
  /** "59.85㎡ A" (전용면적) */
  type: string;
  general: number;
  special: number;
  /** 원(청약홈 만원 × 1만), 없으면 null */
  topPrice: number | null;
}

export interface NoticeDetail {
  /** end 가 null 이면 하루 */
  schedule: { label: string; start: string; end: string | null }[];
  facts: { label: string; value: string }[];
  complexes: NoticeComplex[];
  /** 청약홈 아파트만. 못 받았으면 null */
  houseTypes: NoticeHouseType[] | null;
  contact: { department: string; phone: string | null; url: string | null } | null;
}

export type DetailedNotice = HousingNotice & { detail?: NoticeDetail };

export const noticeHref = (id: string) => `/housing/notice?id=${encodeURIComponent(id)}`;
