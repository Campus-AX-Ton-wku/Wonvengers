/**
 * 일시적 API 실패를 다시 시도한다.
 *
 * 온통청년은 정책을 연달아 조회하면 간헐적으로 403 을 돌려준다
 * (2026-08-30 확인 — 재조회하면 200). 재시도가 없으면 이게 보고서에
 * "대조 못 함"으로 남아 매핑 누락처럼 읽힌다.
 */
export async function withRetry(fn, { attempts = 3, delayMs = 1500 } = {}) {
  let 마지막오류;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      마지막오류 = err;
      // 마지막 시도였으면 기다리지 않고 바로 던진다.
      if (i < attempts - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw 마지막오류;
}
