import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetNavigation } from "./app/__tests__/navigation-mock";

/**
 * next/navigation 을 jsdom history 에 붙인 대역으로 바꾼다 (app/__tests__/navigation-mock.ts).
 *
 * 단계가 주소에 있는 화면과 뒤로가기(TopBar)가 useRouter·useSearchParams·usePathname 을
 * 쓰는데, 진짜 Next 라우터는 앱 라우터 컨텍스트 밖에서 던진다. 파일마다 대역을 쓰면 서로
 * 조금씩 달라진다 — 여기 하나만 둔다. 파일 안에서 vi.mock 을 따로 걸면 그쪽이 이긴다.
 */
vi.mock("next/navigation", async () => (await import("./app/__tests__/navigation-mock")).navigationModule);

/**
 * 화면 테스트 뒷정리. globals 를 켜지 않았으므로 testing-library 의 자동 cleanup 이
 * 걸리지 않는다 — 직접 등록한다. 남겨두면 앞 테스트의 DOM 이 다음 테스트에 보인다.
 *
 * localStorage 도 비운다. 1층 답변·계약 조건이 파일 사이로 새면 테스트가 서로를
 * 오염시킨다 (node 환경 테스트에는 localStorage 가 없으므로 있을 때만).
 *
 * 주소·첫 화면 기록·라우터 호출 기록도 테스트마다 처음으로 돌린다.
 */
afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof window !== "undefined") resetNavigation();
});
