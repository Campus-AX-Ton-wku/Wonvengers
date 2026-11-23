/**
 * 프로필 사진 한 장의 형식 (11/23 ggue — 사진도 계정에, 시안 '내 정보' 설계 노트 '사진으로 꾸미기').
 *
 * 앱(lib/profile-photo.ts)과 서버(apps/api, PUT /me/photo)가 같은 검사를 쓴다. 사용자 데이터 한 덩어리는
 * 64KB 한도라 사진은 따로 한 칸 — 따로 올리고 받는 요청이다.
 *
 * - image: 동그라미 부분만 256×256 JPEG 로 다시 그린 것의 base64(머리말 'data:' 없이). 40KB 이하.
 *   앱이 캔버스로 다시 그려 만든다 — 그 과정에서 촬영 위치 같은 숨은 정보(EXIF)가 남지 않는다.
 * - at: 이 사진을 고른 때(ISO). 프로필 카드(ProfileCardData.photoAt)에 같은 값을 적어 두면
 *   다른 기기가 '사진이 바뀌었다'를 알고 새로 받는다.
 */

/** 사진 파일 상한 (바이트) */
export const MAX_PHOTO_BYTES = 40 * 1024;
/** 요청 본문 상한 — base64 는 4/3 배 + JSON 껍데기 */
export const MAX_PHOTO_BODY_BYTES = 64 * 1024;
/** 저장 크기 (가로 = 세로, px) */
export const PHOTO_SIZE = 256;

export interface ProfilePhotoBody {
  image: string;
  at: string;
}

export type PhotoValidation = { ok: true; value: ProfilePhotoBody } | { ok: false; error: string };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** base64 글자 수 → 실제 바이트 수 */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/** 오류에는 경로만 담는다(값은 담지 않는다) — lib/user-data.ts 와 같은 규칙 */
export function validatePhotoBody(input: unknown): PhotoValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "body: not an object" };
  const o = input as Record<string, unknown>;
  for (const k of Object.keys(o)) if (k !== "image" && k !== "at") return { ok: false, error: `body.${k}: unknown key` };
  const { image, at } = o;
  if (typeof at !== "string" || !ISO.test(at) || Number.isNaN(Date.parse(at))) return { ok: false, error: "body.at: not a timestamp" };
  if (typeof image !== "string" || image.length % 4 !== 0 || !BASE64.test(image)) return { ok: false, error: "body.image: not base64" };
  // JPEG 는 FF D8 FF 로 시작한다 — base64 로 '/9j/'
  if (!image.startsWith("/9j/")) return { ok: false, error: "body.image: not a jpeg" };
  if (base64Bytes(image) > MAX_PHOTO_BYTES) return { ok: false, error: "body.image: too large" };
  return { ok: true, value: { image, at } };
}
