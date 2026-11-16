import { MAX_SAVED } from "./user-data";

/** 찜 목록 연산 (docs/기획/2026-11-17-홈-찜하기-설계.md "1. 찜하기"). 최근 것이 앞, 최대 MAX_SAVED. */
export function isSaved(list: readonly string[], id: string): boolean {
  return list.includes(id);
}

export function toggleSaved(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [id, ...list].slice(0, MAX_SAVED);
}
