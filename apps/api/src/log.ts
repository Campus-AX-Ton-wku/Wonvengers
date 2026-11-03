import { createHash } from "node:crypto";

/**
 * 구조화 로그 한 줄. 사용자 데이터 값은 절대 넣지 않는다(설계 "보안").
 * user 는 sub 의 sha256 앞 16자 — 같은 사람의 요청을 이어 볼 수는 있지만 sub 로 되돌릴 수는 없다.
 * reason 은 오류 이름(err.name)만. 메시지에는 값이 섞일 수 있다.
 */
export interface LogEntry {
  route: string;
  user: string;
  status: number;
  reason?: string;
}

export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

export function logResult(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
}
