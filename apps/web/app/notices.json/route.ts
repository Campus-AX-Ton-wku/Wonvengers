import notices from "@/data/notices.json";

/**
 * 익산 청약 공고 (docs/기획/2026-11-22-청약-공고-설계.md §3). 알림 서버(AWS)가 매시 이 파일을 읽어 '새 공고'를 찾는다.
 * 정적 export 라 빌드 때 out/notices.json 으로 굽힌다. 화면에 이미 실린 값이라 새로 공개되는 것은 없다.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(notices);
}
