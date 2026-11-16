// apps/web/app/__tests__/service-worker.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/** public/sw.js 를 가짜 self 위에서 돌린다. 등록한 처리기를 꺼내 이벤트를 넣어 본다. */
function loadWorker(windows: { url: string; focus: () => Promise<unknown>; navigate: (u: string) => Promise<unknown> }[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null), claim: vi.fn(async () => {}) },
    location: { origin: "https://wonvengers.vercel.app" },
    skipWaiting: vi.fn(async () => {}),
  };
  const source = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  new Function("self", source)(self);
  return { self, handlers };
}

async function dispatch(handler: (event: unknown) => void, extra: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  handler({ ...extra, waitUntil: (p: Promise<unknown>) => (pending = p) });
  await pending;
}

describe("public/sw.js — 알림만 다루는 서비스 워커", () => {
  it("fetch 처리기가 없다 — 캐시로 옛 화면을 보여 주지 않는다", () => {
    const { handlers } = loadWorker();
    expect(Object.keys(handlers).sort()).toEqual(["activate", "install", "notificationclick", "push"]);
  });

  it("푸시를 받으면 제목 · 본문 · 아이콘 · 태그 · 열 주소로 알림을 띄운다", async () => {
    const { self, handlers } = loadWorker();
    const message = { title: "새 지원금이 올라왔어요", body: "본문", url: "/find/policies/a", tag: "new-policy" };
    await dispatch(handlers.push, { data: { json: () => message } });
    expect(self.registration.showNotification).toHaveBeenCalledWith("새 지원금이 올라왔어요", {
      body: "본문",
      icon: "/icon-192.png",
      tag: "new-policy",
      data: { url: "/find/policies/a" },
    });
  });

  it("본문이 깨졌거나 주소가 사이트 밖이면 기본값 — 다른 사이트로 보내지 않는다", async () => {
    const { self, handlers } = loadWorker();
    for (const bad of ["https://evil.example/", "//evil.example/x", "/\\evil.example/x", "/\t/evil.example/x"]) {
      await dispatch(handlers.push, { data: { json: () => ({ title: "t", url: bad }) } });
      expect(self.registration.showNotification).toHaveBeenLastCalledWith("t", expect.objectContaining({ data: { url: "/" } }));
    }
    await dispatch(handlers.push, { data: { json: () => ({ title: "t", url: "/find/policies/a?x=1#y" }) } });
    expect(self.registration.showNotification).toHaveBeenLastCalledWith(
      "t",
      expect.objectContaining({ data: { url: "/find/policies/a?x=1#y" } })
    );
    await dispatch(handlers.push, { data: { json: () => { throw new Error("bad"); } } });
    expect(self.registration.showNotification).toHaveBeenLastCalledWith("Perky", expect.objectContaining({ body: "" }));
  });

  it("알림을 누르면 열린 창이 있으면 그 창을 그 주소로, 없으면 새 창", async () => {
    const close = vi.fn();
    const open = loadWorker();
    await dispatch(open.handlers.notificationclick, { notification: { close, data: { url: "/find/policies/a" } } });
    expect(close).toHaveBeenCalled();
    expect(open.self.clients.openWindow).toHaveBeenCalledWith("https://wonvengers.vercel.app/find/policies/a");

    const win = { url: "https://wonvengers.vercel.app/account", focus: vi.fn(async () => win), navigate: vi.fn(async () => win) };
    const existing = loadWorker([win]);
    await dispatch(existing.handlers.notificationclick, { notification: { close, data: { url: "/find/policies" } } });
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith("https://wonvengers.vercel.app/find/policies");
    expect(existing.self.clients.openWindow).not.toHaveBeenCalled();

    const outside = loadWorker();
    await dispatch(outside.handlers.notificationclick, { notification: { close, data: { url: "https://evil.example/" } } });
    expect(outside.self.clients.openWindow).toHaveBeenCalledWith("https://wonvengers.vercel.app/");
  });
});
