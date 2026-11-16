// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLocalContent, loadDocumentChecks, loadSaved, onLocalChange, readLocalContent, saveDocumentChecks,
  saveSavedList, toggleSavedPolicy, writeLocalContent,
} from "../storage";
import { emptyContent } from "../user-data";

beforeEach(() => window.localStorage.clear());

describe("찜 · 서류 체크 기기 저장", () => {
  it("찜은 perky.saved 에, 토글은 바뀐 상태를 돌려주고 변경을 알린다", () => {
    let changes = 0;
    const off = onLocalChange(() => changes++);
    expect(toggleSavedPolicy("a")).toBe(true);
    expect(toggleSavedPolicy("b")).toBe(true);
    expect(loadSaved()).toEqual(["b", "a"]);
    expect(toggleSavedPolicy("a")).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("perky.saved")!)).toEqual(["b"]);
    expect(changes).toBe(3);
    off();
  });

  it("깨진 값은 빈 목록으로 읽는다", () => {
    window.localStorage.setItem("perky.saved", "{");
    expect(loadSaved()).toEqual([]);
  });

  it("서류 체크는 정책마다 perky.document-checks:<id>", () => {
    saveDocumentChecks("a", ["임대차계약서 사본"]);
    expect(window.localStorage.getItem("perky.document-checks:a")).toBe('["임대차계약서 사본"]');
    expect(loadDocumentChecks("a")).toEqual(["임대차계약서 사본"]);
    expect(loadDocumentChecks("zz")).toEqual([]);
  });

  it("동기화 묶음에 실리고, 비우기가 지우고, 쓰기가 되살린다", () => {
    saveSavedList(["a"]);
    saveDocumentChecks("a", ["x"]);
    const c = readLocalContent();
    expect(c.saved).toEqual(["a"]);
    expect(c.documentChecks).toEqual({ a: ["x"] });
    clearLocalContent();
    expect(readLocalContent().saved).toEqual([]);
    expect(window.localStorage.getItem("perky.document-checks:a")).toBeNull();
    writeLocalContent({ ...emptyContent(), saved: ["b"], documentChecks: { b: ["y"] } });
    expect(loadSaved()).toEqual(["b"]);
    expect(loadDocumentChecks("b")).toEqual(["y"]);
  });
});
