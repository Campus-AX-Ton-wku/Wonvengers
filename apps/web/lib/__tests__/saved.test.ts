import { describe, expect, it } from "vitest";
import { isSaved, toggleSaved } from "../saved";

describe("찜 목록 연산", () => {
  it("없으면 맨 앞에 넣고, 있으면 뺀다", () => {
    expect(toggleSaved(["b"], "a")).toEqual(["a", "b"]);
    expect(toggleSaved(["a", "b"], "a")).toEqual(["b"]);
  });
  it("50건을 넘으면 가장 오래된 것(맨 뒤)부터 빠진다", () => {
    const full = Array.from({ length: 50 }, (_, i) => `p${i}`);
    const next = toggleSaved(full, "new");
    expect(next).toHaveLength(50);
    expect(next[0]).toBe("new");
    expect(next).not.toContain("p49");
  });
  it("원본을 바꾸지 않는다", () => {
    const list = ["a"];
    toggleSaved(list, "b");
    expect(list).toEqual(["a"]);
  });
  it("isSaved", () => {
    expect(isSaved(["a"], "a")).toBe(true);
    expect(isSaved([], "a")).toBe(false);
  });
});
