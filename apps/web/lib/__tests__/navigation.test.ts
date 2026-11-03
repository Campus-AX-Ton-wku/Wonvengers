// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ENTRY_KEY, ENTRY_SCRIPT, isEntryPage, moveEntryOnReplace } from "../entry";
import { replaceKeepingEntry, resolveStep, stepHref, useBack, useStepParam } from "../navigation";
import { resetNavigation, routerMock } from "@/app/__tests__/navigation-mock";

const KEYS = ["a", "b", "c"] as const;
type Key = (typeof KEYS)[number];

const blocked = () =>
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });

afterEach(() => {
  vi.restoreAllMocks();
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

  it("기록과 지금 주소가 같으면 첫 화면이다", () => {
    resetNavigation("/find?q=status");
    expect(isEntryPage()).toBe(true);
  });

  it("다르면 앞 화면이 앱 안에 있다", () => {
    resetNavigation("/find?q=status", "/find?q=birth");
    expect(isEntryPage()).toBe(false);
  });

  it("sessionStorage 가 막혀 있으면 첫 화면으로 본다 — 앱 밖으로 튕기는 것보다 안전하다", () => {
    resetNavigation("/find?q=status", "/find?q=birth");
    blocked();
    expect(isEntryPage()).toBe(true);
  });

  it("첫 화면에서 replace 하면 기록도 옮긴다", () => {
    resetNavigation("/find");
    moveEntryOnReplace("/find?q=birth");
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/find?q=birth");
  });

  it("첫 화면이 아니면 기록을 건드리지 않는다", () => {
    resetNavigation("/find", "/onboarding");
    moveEntryOnReplace("/find?q=birth");
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/onboarding");
  });

  it("replaceKeepingEntry 는 기록을 옮기고 router.replace 한다", () => {
    resetNavigation("/onboarding");
    replaceKeepingEntry(routerMock, "/find");
    expect(routerMock.replace).toHaveBeenCalledWith("/find");
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/find");
  });
});

describe("ENTRY_SCRIPT (<head> 인라인)", () => {
  const run = () => new Function(ENTRY_SCRIPT)();

  it("처음 로드된 주소를 적는다", () => {
    resetNavigation("/find/policies?x=1", null);
    run();
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/find/policies?x=1");
  });

  it("이미 적혀 있으면 덮지 않는다 — 새로고침해도 판정이 유지된다", () => {
    resetNavigation("/result", "/find?q=birth");
    run();
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/find?q=birth");
  });

  it("'/' 는 적지 않는다 — 곧바로 /onboarding 으로 replace 되고 그 로드가 적는다", () => {
    resetNavigation("/", null);
    run();
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBeNull();
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
    expect(window.sessionStorage.getItem(ENTRY_KEY)).toBe("/find/result");
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
