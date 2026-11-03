/**
 * next/navigation 테스트 대역. vitest.setup.ts 가 모든 테스트 파일에 건다.
 *
 * 라우터를 jsdom 의 진짜 history 에 붙인다. push·replace 는 주소를 바꾸고 화면을 다시
 * 그리게 하며, history.back() 은 jsdom 이 popstate 를 내서 그 주소로 다시 그려진다.
 * 단계가 주소에 있는 화면(/find·/calculate·/eligibility)은 이게 없으면 "다음" 을 눌러도
 * 넘어가지 않는다.
 *
 * 파일 안에서 vi.mock("next/navigation", …) 을 따로 걸면 그쪽이 이긴다.
 */
import { useMemo, useSyncExternalStore } from "react";
import { vi } from "vitest";
import { ENTRY_KEY } from "@/lib/entry";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== "undefined") window.addEventListener("popstate", notify);

export const routerMock = {
  push: vi.fn((href: string) => {
    window.history.pushState(null, "", href);
    notify();
  }),
  replace: vi.fn((href: string) => {
    window.history.replaceState(null, "", href);
    notify();
  }),
  back: vi.fn(() => window.history.back()),
  forward: vi.fn(() => window.history.forward()),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  // 렌더마다 새 객체를 주면 searchParams 를 의존성으로 쓰는 훅이 매번 다시 돈다.
  return useMemo(() => new URLSearchParams(search), [search]);
}

function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => "/");
}

export const navigationModule = {
  useRouter: () => routerMock,
  useSearchParams,
  usePathname,
  notFound: vi.fn(),
  redirect: vi.fn(),
};

/**
 * 주소를 url 로 두고, 이 탭의 첫 화면 기록을 entry 로 맞춘다(null = 기록 없음).
 * 기본값은 "지금 화면이 첫 화면" — 링크로 바로 들어온 상태다.
 */
export function resetNavigation(url = "/", entry: string | null = url): void {
  window.history.replaceState(null, "", url);
  try {
    window.sessionStorage.clear();
    if (entry !== null) window.sessionStorage.setItem(ENTRY_KEY, entry);
  } catch {
    // 저장소를 막아 둔 테스트가 있다. 그 테스트가 스스로 되돌린다.
  }
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.forward.mockClear();
  routerMock.refresh.mockClear();
  routerMock.prefetch.mockClear();
  notify();
}
