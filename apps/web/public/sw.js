// apps/web/public/sw.js
/*
 * Perky 서비스 워커 — 알림만 (docs/기획/2026-11-16-새-정책-알림-설계.md "서비스 워커").
 * fetch 를 가로채지 않는다(캐시 없음). 등록은 내 계정 화면이 [알림 켜기] 때 한다(lib/push.ts).
 * 이 파일은 빌드 없이 그대로 나간다 — 최신 문법을 아끼고, import 하지 않는다.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Perky";
  // 사이트 안 주소만 연다 — "/" 로 시작하고 "//" 가 아닌 것
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/";
  // iOS 는 푸시마다 알림을 띄워야 권한이 유지된다 — 항상 띄운다
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          await client.navigate(target);
          return;
        } catch (_) {
          break; // 이 창으로 못 옮기면 새 창
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
