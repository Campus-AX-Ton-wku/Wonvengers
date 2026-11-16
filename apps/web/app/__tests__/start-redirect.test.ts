import { describe, expect, it, vi } from "vitest";
import { AUTH_KEY } from "@/lib/auth";
import { START_REDIRECT } from "@/lib/start-redirect";

/** 인라인 스크립트를 가짜 location · localStorage 로 돌린다. */
function run(pathname: string, auth: string | null, throws = false) {
  const replace = vi.fn();
  const location = { pathname, replace };
  const localStorage = {
    getItem: (k: string) => {
      if (throws) throw new Error("blocked");
      return k === "perky.auth" ? auth : null;
    },
  };
  new Function("location", "localStorage", START_REDIRECT)(location, localStorage);
  return replace;
}

describe("시작 주소 /", () => {
  it("로그인 기록이 있으면 /home", () => expect(run("/", '{"sub":"a"}')).toHaveBeenCalledWith("/home"));
  it("없으면 /onboarding", () => expect(run("/", null)).toHaveBeenCalledWith("/onboarding"));
  it("저장소가 막혀 있으면 /onboarding", () => expect(run("/", null, true)).toHaveBeenCalledWith("/onboarding"));
  it("다른 주소는 건드리지 않는다", () => expect(run("/find", '{"sub":"a"}')).not.toHaveBeenCalled());
});

it("START_REDIRECT 가 읽는 키는 AUTH_KEY 와 같다", () => {
  expect(START_REDIRECT).toContain(JSON.stringify(AUTH_KEY));
});
