// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/remote", () => ({ loadRemote: vi.fn(), saveRemote: vi.fn(), deleteAccountRemote: vi.fn() }));

import ResultPage from "@/app/result/page";
import FindPoliciesPage from "@/app/find/policies/page";
import ApplicationPreparation from "@/app/find/policies/[id]/prepare/ApplicationPreparation";
import PolicyDetail from "@/app/find/policies/[id]/PolicyDetail";
import policiesJson from "@/data/policies.json";
import { resetAuthForTests } from "@/lib/auth";
import { saveAnswers, saveListing, saveProfile } from "@/lib/storage";
import type { PolicyMeta } from "@/lib/types";
import { birthDateForAge, makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

/**
 * 11/20 아이폰 홈 화면 앱: 결과 화면의 하단 섬 탭이 화면에 붙지 않고 본문과 같이 스크롤됐다.
 * 화면 전체(AppShell)에 등장 애니메이션(step-in = transform)이 걸려 있었고 섬이 그 안에 있었다.
 * transform 이 도는 조상 안의 fixed 는 그 조상에 붙는다 — iOS 는 애니메이션이 끝난 뒤에도
 * 처음 그린 자리(문서 기준)에 남겨 둔 채 스크롤했다. 데스크톱 · 에뮬레이터에서는 재현되지 않는다.
 *
 * 위에 붙는 상단바(sticky)도 같이 쓸려 올라갔다(영상 2초).
 *
 * 그래서 화면에 붙어야 하는 것(상단바 · 하단 섬 · 아래 고정 버튼)은 애니메이션 클래스 안에 두지 않는다.
 * 움직임은 <main> 에만 준다(계산 · 질문 화면과 같은 방식).
 */
const ANIMATED = ".step-in, .rise-in, .stagger-in, .amount-in, .amount-reveal, .slide-in";
const 상단바 = () => screen.getByRole("button", { name: "이전 단계로" });

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe("화면에 붙는 것은 애니메이션 조상 안에 두지 않는다", () => {
  it("결과 화면의 하단 섬", async () => {
    enableLogin();
    signInAs();
    saveListing(makeListing({ oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
    expect(nav.closest(ANIMATED)).toBeNull();
    expect(상단바().closest(ANIMATED)).toBeNull();
  });

  it("지원금 목록의 하단 섬", async () => {
    enableLogin();
    signInAs();
    saveAnswers({ birthDate: birthDateForAge(23), region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세" });
    render(<FindPoliciesPage />);
    const nav = await screen.findByRole("navigation", { name: "주요 메뉴" });
    expect(nav.closest(ANIMATED)).toBeNull();
    expect(상단바().closest(ANIMATED)).toBeNull();
  });

  it("신청 준비의 상단바 · 아래 고정 버튼", () => {
    const policy = (policiesJson as PolicyMeta[])[0];
    render(<ApplicationPreparation policy={policy} />);
    const button = screen.getByRole("button", { name: "공식 신청 사이트로 이동" });
    expect(button.closest(ANIMATED)).toBeNull();
    expect(상단바().closest(ANIMATED)).toBeNull();
  });

  it("정책 상세의 상단바", async () => {
    render(<PolicyDetail id={(policiesJson as PolicyMeta[])[0].id} />);
    expect((await screen.findByRole("button", { name: "이전 단계로" })).closest(ANIMATED)).toBeNull();
  });
});
