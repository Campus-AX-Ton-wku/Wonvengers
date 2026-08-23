import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * 화면 테스트 뒷정리. globals 를 켜지 않았으므로 testing-library 의 자동 cleanup 이
 * 걸리지 않는다 — 직접 등록한다. 남겨두면 앞 테스트의 DOM 이 다음 테스트에 보인다.
 *
 * localStorage 도 비운다. 1층 답변·계약 조건이 파일 사이로 새면 테스트가 서로를
 * 오염시킨다 (node 환경 테스트에는 localStorage 가 없으므로 있을 때만).
 */
afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
});
