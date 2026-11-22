/**
 * 카카오 지도 JavaScript SDK 를 한 번만 불러온다 (서류 떼는 곳 지도, 11/22).
 * 키는 NEXT_PUBLIC_KAKAO_JS_KEY — 카카오 콘솔에서 도메인(wonvengers.vercel.app · localhost:3000 · 127.0.0.1:4321)으로 묶여 있다.
 * 키가 없거나 · 스크립트가 막히거나 · 시간이 지나면 실패로 끝낸다 — 화면은 목록으로 보여 준다.
 */

// SDK 는 타입을 주지 않는다. 쓰는 곳(PlacesView)에서만 좁게 다룬다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KakaoMaps = any;

let pending: Promise<KakaoMaps> | null = null;

export function loadKakaoMaps(appKey: string | undefined, timeoutMs = 8_000): Promise<KakaoMaps> {
  if (!appKey) return Promise.reject(new Error("no-key"));
  const w = window as { kakao?: { maps?: KakaoMaps } };
  if (w.kakao?.maps?.LatLng) return Promise.resolve(w.kakao.maps);
  if (pending) return pending;
  pending = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    script.addEventListener("load", () => {
      const maps = w.kakao?.maps;
      if (!maps) {
        clearTimeout(timer);
        reject(new Error("no-sdk"));
        return;
      }
      maps.load(() => {
        clearTimeout(timer);
        resolve(maps);
      });
    });
    script.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("load-failed"));
    });
    document.head.appendChild(script);
  }).catch((err) => {
    pending = null;
    throw err;
  });
  return pending;
}

export function resetKakaoMapsForTest(): void {
  pending = null;
}
