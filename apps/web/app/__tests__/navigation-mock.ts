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
import { ENTRY_KEY, ENTRY_STATE } from "@/lib/entry";

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

/** 테스트가 쓰는 첫 화면 표의 값. */
export const TEST_ENTRY_TAG = "test-entry";

/**
 * 주소를 url 로 두고, 이 탭의 첫 화면을 entry 로 맞춘다(null = 기록 없음).
 * 기본값은 "지금 화면이 첫 화면" — 링크로 바로 들어온 상태다.
 *
 * entry 가 url 과 다르면 entry 칸에 표를 달고 그 위에 url 을 push 한다. 진짜 브라우저처럼
 * 첫 화면은 기록의 칸으로 가린다(lib/entry.ts). history.back() 하면 entry 로 돌아간다.
 */
export function resetNavigation(url = "/", entry: string | null = url): void {
  const tagged = { [ENTRY_STATE]: TEST_ENTRY_TAG };
  if (entry === null) window.history.replaceState(null, "", url);
  else if (entry === url) window.history.replaceState(tagged, "", url);
  else {
    window.history.replaceState(tagged, "", entry);
    window.history.pushState(null, "", url);
  }
  try {
    window.sessionStorage.clear();
    if (entry !== null) window.sessionStorage.setItem(ENTRY_KEY, TEST_ENTRY_TAG);
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
