import policies from "@/data/policies.json";

/**
 * 공개 정책 목록 (docs/기획/2026-11-16-새-정책-알림-설계.md "1. 앱").
 *
 * 알림 서버(AWS)가 매시 정각 이 파일을 읽어 '새 정책'을 찾는다. DB 가 아니라 배포된 앱이 실은 목록을
 * 보는 이유: DB 값이 검사에 걸려 빌드가 멈추면 앱에는 없는 정책을 알리게 된다.
 * 정적 export 라 빌드 때 out/policies.json 으로 굽힌다. 화면 번들에 이미 실린 값이라 새로 공개되는 것은 없다.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(policies);
}
