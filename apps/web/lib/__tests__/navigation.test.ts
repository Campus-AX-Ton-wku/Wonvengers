// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ENTRY_KEY, ENTRY_REDIRECT_KEY, ENTRY_SCRIPT, ENTRY_STATE, isEntryPage } from "../entry";
import { replaceKeepingEntry, resolveStep, stepHref, useBack, useStepParam } from "../navigation";
import { resetNavigation, routerMock, TEST_ENTRY_TAG } from "@/app/__tests__/navigation-mock";

const KEYS = ["a", "b", "c"] as const;
type Key = (typeof KEYS)[number];

const blocked = () =>
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const tagHere = () => (window.history.state as Record<string, unknown> | null)?.[ENTRY_STATE];

/** history.back() 은 jsdom 에서 popstate 가 다음 작업에 온다. */
const goBack = () =>
  new Promise<void>((done) => {
    window.addEventListener("popstate", () => done(), { once: true });
    window.history.back();
  });

describe("resolveStep", () => {
  const all = () => true;

  it("갈 수 있는 단계 주소면 그대로 쓴다", () => {
    expect(resolveStep("b", KEYS, "a", all)).toEqual({ step: "b", redirect: false });
  });

  it("주소에 단계가 없으면 첫 미답 단계로 돌린다", () => {
    expect(resolveStep(null, KEYS, "b", all)).toEqual({ step: "b", redirect: true });
  });

  it("모르는 값이면 첫 미답 단계로 돌린다", () => {
    expect(resolveStep("zzz", KEYS, "a", all)).toEqual({ step: "a", redirect: true });
  });

  it("앞 단계를 건너뛴 주소면 첫 미답 단계로 돌린다", () => {
    expect(resolveStep<Key>("c", KEYS, "a", (k) => k !== "c")).toEqual({ step: "a", redirect: true });
  });
});

describe("stepHref", () => {
  it("단계 하나만 쿼리에 둔다", () => {
    expect(stepHref("/find", "q", "income")).toBe("/find?q=income");
  });

  it("덧붙일 값은 인코딩해 붙인다", () => {
    const href = stepHref("/find", "q", "region", { p: "전북특별자치도" });
    expect(href.startsWith("/find?q=region&p=")).toBe(true);
    expect(new URL(href, "http://x").searchParams.get("p")).toBe("전북특별자치도");
  });
});

describe("이 탭의 첫 화면", () => {
  it("기록이 없으면 첫 화면으로 본다", () => {
    resetNavigation("/find?q=status", null);
    expect(isEntryPage()).toBe(true);
  });

  it("지금 칸에 첫 화면 표가 있으면 첫 화면이다", () => {
    resetNavigation("/find?q=status");
    expect(isEntryPage()).toBe(true);
  });

  it("표가 없는 칸이면 앞 화면이 앱 안에 있다", () => {
    resetNavigation("/find?q=status", "/find?q=birth");
    expect(isEntryPage()).toBe(false);
  });

  it("첫 화면과 같은 주소라도 새로 push 한 칸이면 첫 화면이 아니다 — 요약 줄로 첫 질문에 돌아온 경우", async () => {
    // /find?q=birth(첫 화면) → ?q=region → ?q=status → 요약 줄 "만 N세" 가 ?q=birth 를 push
    resetNavigation("/find?q=birth");
    window.history.pushState(null, "", "/find?q=region");
    window.history.pushState(null, "", "/find?q=status");
    window.history.pushState(null, "", "/find?q=birth");
    expect(isEntryPage()).toBe(false);

    // 처음 칸까지 뒤로 가면 다시 첫 화면이다
    await goBack();
    await goBack();
    await goBack();
    expect(window.location.search).toBe("?q=birth");
    expect(isEntryPage()).toBe(true);
  });

  it("탭에 기록이 한 칸뿐이면 첫 화면으로 본다 — sessionStorage 만 복사된 새 탭", () => {
    resetNavigation("/find?q=status", "/find?q=birth");
    vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    expect(isEntryPage()).toBe(true);
  });

  it("sessionStorage 가 막혀 있으면 첫 화면으로 본다 — 앱 밖으로 튕기는 것보다 안전하다", () => {
    resetNavigation("/find?q=status", "/find?q=birth");
    blocked();
    expect(isEntryPage()).toBe(true);
  });

  it("첫 화면에서 replaceKeepingEntry 하면 바뀐 칸에도 표를 다시 단다", () => {
    resetNavigation("/onboarding");
    replaceKeepingEntry(routerMock, "/find");
    expect(routerMock.replace).toHaveBeenCalledWith("/find");
    expect(tagHere()).toBe(TEST_ENTRY_TAG);
    expect(isEntryPage()).toBe(true);
  });

  it("첫 화면이 아니면 replace 해도 표를 달지 않는다", () => {
    resetNavigation("/find", "/onboarding");
    replaceKeepingEntry(routerMock, "/find?q=birth");
    expect(tagHere()).toBeUndefined();
    expect(isEntryPage()).toBe(false);
  });

  it("기록이 없던 첫 화면에서 replace 하면 표를 새로 만들어 단다", () => {
    resetNavigation("/find", null);
    window.history.pushState(null, "", "/find"); // 한 칸뿐이라 첫 화면으로 보는 규칙을 피한다
    replaceKeepingEntry(routerMock, "/find?q=birth");
    const tag = window.sessionStorage.getItem(ENTRY_KEY);
    expect(tag).not.toBeNull();
    expect(tagHere()).toBe(tag);
  });

  it("Next 의 replace 는 늦게 반영된다 — 반영된 뒤에 표를 달고, 그 사이에도 첫 화면으로 본다", () => {
    vi.useFakeTimers();
    resetNavigation("/onboarding");
    // 진짜 Next 처럼: 나중에, 표 없는 새 state 로 replace 한다
    const lateRouter = {
      replace: (href: string) => setTimeout(() => window.history.replaceState({ __NA: true }, "", href), 100),
    };

    replaceKeepingEntry(lateRouter, "/find");
    expect(isEntryPage()).toBe(true); // 아직 /onboarding

    // 반영 전에 다음 replace 가 온다 (/find → /find?q=birth)
    vi.advanceTimersByTime(100);
    expect(window.location.pathname).toBe("/find");
    replaceKeepingEntry(lateRouter, "/find?q=birth");
    vi.advanceTimersByTime(200);

    expect(window.location.search).toBe("?q=birth");
    expect(tagHere()).toBe(TEST_ENTRY_TAG);
    expect((window.history.state as Record<string, unknown>).__NA).toBe(true); // Next 의 state 는 남긴다
    expect(isEntryPage()).toBe(true);
  });

  it("replace 가 끝내 반영되지 않으면 기다리기를 그만둔다", () => {
    vi.useFakeTimers();
    resetNavigation("/onboarding");
    replaceKeepingEntry({ replace: () => {} }, "/find");
    window.history.pushState(null, "", "/elsewhere");
    expect(isEntryPage()).toBe(true); // 기다리는 중
    vi.advanceTimersByTime(11_000);
    expect(isEntryPage()).toBe(false);
  });
});

describe("ENTRY_SCRIPT (<head> 인라인)", () => {
  const run = () => new Function(ENTRY_SCRIPT)();

  it("처음 로드된 칸에 표를 달고 그 값을 적는다", () => {
    resetNavigation("/find/policies?x=1", null);
    window.history.replaceState({ kept: 1 }, "");
    run();
    const tag = window.sessionStorage.getItem(ENTRY_KEY);
    expect(tag).toMatch(/^[a-z0-9]+$/);
    expect(tagHere()).toBe(tag);
    expect((window.history.state as Record<string, unknown>).kept).toBe(1);
    expect(window.location.pathname + window.location.search).toBe("/find/policies?x=1");
  });

  it("이미 적혀 있으면 덮지 않는다 — 새로고침해도 판정이 유지된다", () => {
    resetNavigation("/result", "/find?q=birth");
    run();
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe(TEST_ENTRY_TAG);
    expect(tagHere()).toBeUndefined();
  });

  it("'/' 에서는 달지 않는다 — 곧바로 /onboarding 으로 replace 되고 그 로드가 단다", () => {
    resetNavigation("/", null);
    run();
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBeNull();
    expect(tagHere()).toBeUndefined();
  });

  it("첫 화면 칸인 '/' 를 새로고침하면 /onboarding 으로 바뀐 그 칸에 같은 표를 다시 단다", () => {
    resetNavigation("/");
    run(); // "/" 로드: location.replace 직전
    expect(window.sessionStorage.getItem(ENTRY_REDIRECT_KEY)).toBe("1");

    window.history.replaceState(null, "", "/onboarding"); // location.replace 는 state 를 비운다
    run();
    expect(tagHere()).toBe(TEST_ENTRY_TAG);
    expect(window.sessionStorage.getItem(ENTRY_REDIRECT_KEY)).toBeNull();
  });

  it("첫 화면이 아닌 '/' 를 새로고침하면 표를 옮기지 않는다", () => {
    resetNavigation("/", "/find?q=birth");
    run();
    window.history.replaceState(null, "", "/onboarding");
    run();
    expect(tagHere()).toBeUndefined();
  });

  it("저장소가 막혀 있어도 던지지 않는다", () => {
    resetNavigation("/find", null);
    blocked();
    expect(run).not.toThrow();
  });
});

describe("useStepParam", () => {
  const opts = (over: Partial<{ ready: boolean; firstUnanswered: Key; isReachable: (k: Key) => boolean }> = {}) => ({
    ready: true,
    firstUnanswered: "a" as Key,
    isReachable: (_k: Key) => true,
    ...over,
  });

  it("주소에 단계가 없으면 첫 미답 단계 주소로 replace 한다", () => {
    resetNavigation("/find");
    const { result } = renderHook(() => useStepParam("q", KEYS, opts({ firstUnanswered: "b" })));

    expect(routerMock.replace).toHaveBeenCalledWith("/find?q=b");
    expect(result.current.step).toBe("b");
    expect(window.location.search).toBe("?q=b");
  });

  it("주소의 단계를 읽는다 — 그때는 replace 하지 않는다", () => {
    resetNavigation("/find?q=c");
    const { result } = renderHook(() => useStepParam("q", KEYS, opts()));

    expect(result.current.step).toBe("c");
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("갈 수 없는 단계 주소면 첫 미답 단계로 replace 한다", () => {
    resetNavigation("/find?q=c");
    renderHook(() => useStepParam("q", KEYS, opts({ isReachable: (k) => k === "a" })));

    expect(routerMock.replace).toHaveBeenCalledWith("/find?q=a");
  });

  it("저장된 답을 불러오기 전에는 주소를 고치지 않는다", () => {
    resetNavigation("/find?q=c");
    const { result } = renderHook(() =>
      useStepParam("q", KEYS, opts({ ready: false, isReachable: () => false }))
    );

    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(result.current.step).toBe("c");
  });

  it("go 는 다음 단계 주소를 push 한다 — 기록이 하나 쌓인다", () => {
    resetNavigation("/find?q=a");
    const { result } = renderHook(() => useStepParam("q", KEYS, opts()));

    act(() => result.current.go("b", { p: "x" }));

    expect(routerMock.push).toHaveBeenCalledWith("/find?q=b&p=x");
    expect(result.current.step).toBe("b");
    expect(result.current.query("p")).toBe("x");
  });
});

describe("useBack", () => {
  it("앞 화면이 앱 안이면 history.back()", () => {
    resetNavigation("/find/policies", "/find?q=birth");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result } = renderHook(() => useBack("/find/result"));

    act(() => result.current());

    expect(back).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("이 탭의 첫 화면이면 backHref 로 replace 하고, 그 자리를 새 첫 화면으로 삼는다", () => {
    resetNavigation("/find/policies");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result } = renderHook(() => useBack("/find/result"));

    act(() => result.current());

    expect(routerMock.replace).toHaveBeenCalledWith("/find/result");
    expect(back).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/find/result");
    expect(tagHere()).toBe(TEST_ENTRY_TAG);
    expect(isEntryPage()).toBe(true);
  });

  it("sessionStorage 가 막혀 있으면 backHref 로 간다", () => {
    resetNavigation("/find/policies", "/find?q=birth");
    blocked();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result } = renderHook(() => useBack("/find/result"));

    act(() => result.current());

    expect(routerMock.replace).toHaveBeenCalledWith("/find/result");
    expect(back).not.toHaveBeenCalled();
  });
});
