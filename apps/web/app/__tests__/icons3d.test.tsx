// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ChoiceCard, Icon3D } from "@/app/components";
import FindPage from "@/app/find/page";
import FindPoliciesPage from "@/app/find/policies/page";
import PolicyDetail from "@/app/find/policies/[id]/PolicyDetail";
import ApplicationPreparation from "@/app/find/policies/[id]/prepare/ApplicationPreparation";
import policiesJson from "@/data/policies.json";
import loanProductsJson from "@/data/loan-products.json";
import { ICON3D_NAMES, POLICY_ICONS, documentIcon } from "@/lib/icons3d";
import { saveAnswers, saveAnsweredKeys } from "@/lib/storage";
import type { LoanProductMeta, PolicyMeta } from "@/lib/types";
import { birthDateForAge } from "@/lib/__tests__/fixtures";
import { resetNavigation } from "./navigation-mock";

/**
 * 3D 아이콘 (2026-11-18 디자인 시안 '3D 아이콘 설계', lib/icons3d.ts).
 * 그림은 뜻을 말하지 않는다(alt="") — 옆 글자가 말한다. 그래서 여기서는 data-icon3d 로 어떤 그림인지 본다.
 */
const policies = policiesJson as PolicyMeta[];
const icons = (root: ParentNode = document) =>
  [...root.querySelectorAll("img[data-icon3d]")].map((el) => el.getAttribute("data-icon3d"));

describe("그림 파일과 이름", () => {
  const dir = join(__dirname, "..", "..", "public", "icons3d");

  it("이름마다 256px WebP 가 하나씩, 남는 파일이 없다", () => {
    for (const name of ICON3D_NAMES) expect(existsSync(join(dir, `${name}.webp`))).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(ICON3D_NAMES.map((n) => `${n}.webp`).sort());
  });

  it("지금 앱에 실린 정책 · 안내 상품은 모두 정책 종류 그림을 갖는다", () => {
    for (const p of [...policies, ...(loanProductsJson as LoanProductMeta[])]) {
      expect(POLICY_ICONS, p.id).toContain(p.icon);
    }
  });

  it("Icon3D — 읽지 않는 그림, 크기를 미리 잡는다", () => {
    render(<Icon3D name="rent" size={40} />);
    const img = document.querySelector("img[data-icon3d]")!;
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(img.getAttribute("src")).toBe("/icons3d/rent.webp");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["40", "40"]);
  });
});

describe("서류 이름 → 그림", () => {
  it("팀이 입력한 실제 서류 이름 (11/17)", () => {
    expect(documentIcon("임대차(전대차) 계약서 또는 사용대차 확인서")).toBe("contract");
    expect(documentIcon("주민등록 등·초본")).toBe("resident");
    expect(documentIcon("통장사본")).toBe("bankbook");
    expect(documentIcon("신분증")).toBe("id-card");
    expect(documentIcon("위임받는 사람 · 위임하는 사람 신분증")).toBe("id-card");
    // '주민등록'이 들어 있어도 신분증은 신분증 — 등본 규칙보다 먼저 잡는다
    for (const name of ["주민등록증", "주민등록증 사본", "운전면허증", "여권"]) expect(documentIcon(name), name).toBe("id-card");
    expect(documentIcon("주민등록등본")).toBe("resident");
    // 맞는 그림이 없는 서류는 서식 하나로 — '금융정보 등 제공동의서'의 '등'은 등본이 아니다
    for (const name of ["전입세대 전입장려금 신청서", "개인정보 동의서", "위임장", "소득 및 재산 신고서", "금융정보 등 제공동의서"]) {
      expect(documentIcon(name), name).toBe("form");
    }
  });

  it("지금 데이터의 서류는 모두 그림이 있다", () => {
    for (const d of policies.flatMap((p) => p.documents ?? [])) expect(ICON3D_NAMES).toContain(documentIcon(d.name));
  });
});

describe("들어간 자리", () => {
  beforeEach(() => window.localStorage.clear());

  it("선택지 — icon 을 주면 글자 왼쪽에 36px, 안 주면 그림 없음", () => {
    const { unmount } = render(<ChoiceCard active={false} onClick={() => {}} icon="work">재직</ChoiceCard>);
    const button = screen.getByRole("button", { name: "재직" });
    expect(icons(button)).toEqual(["work"]);
    expect(button.querySelector("img")!.getAttribute("width")).toBe("36");
    unmount();
    render(<ChoiceCard active={false} onClick={() => {}}>그렇다</ChoiceCard>);
    expect(icons(screen.getByRole("button", { name: "그렇다" }))).toEqual([]);
  });

  it("첫 질문 — 현재 상태 · 주거 형태는 선택지마다, 지역 · 소득은 그림 없이", () => {
    const answers = { birthDate: "1998-03-14", region: "전북특별자치도 익산시", status: "재직" as const, incomeBracket: 2, housingType: "월세" as const };
    saveAnswers(answers);
    saveAnsweredKeys(["birthDate", "region", "status", "incomeBracket", "housingType"]);

    resetNavigation("/find?q=status");
    const { unmount } = render(<FindPage />);
    expect(icons()).toEqual(["student", "work", "job-seek"]);
    unmount();

    resetNavigation("/find?q=housing");
    const second = render(<FindPage />);
    expect(icons()).toEqual(["monthly", "yearly", "jeonse", "other"]);
    second.unmount();

    resetNavigation("/find?q=income");
    render(<FindPage />);
    expect(icons()).toEqual([]);
  });

  it("신청 준비 — 서류가 있으면 '자격과 기간' · '챙길 서류 N개' 두 묶음, 서류 줄마다 32px", () => {
    const policy = policies.find((p) => p.id === "youth-housing-benefit-split-payment")!;
    const docs = policy.documents ?? [];
    render(<ApplicationPreparation policy={policy} />);
    const list = screen.getByRole("region", { name: "신청 전 확인 목록" });
    expect(icons(list)).toEqual(docs.map((d) => documentIcon(d.name)));
    expect(list.querySelector("img")!.getAttribute("width")).toBe("32");
    // 그림 없는 확인 줄과 그림 있는 서류 줄이 한 묶음에 섞이지 않는다 — 묶음 안에서는 글자 시작선이 같다
    const checks = within(list).getByRole("group", { name: "자격과 기간" });
    const documents = within(list).getByRole("group", { name: `챙길 서류 ${docs.length}개` });
    expect(within(checks).getAllByRole("checkbox")).toHaveLength(2);
    expect(icons(checks)).toEqual([]);
    expect(within(documents).getAllByRole("checkbox")).toHaveLength(docs.length);
    expect(documents.querySelectorAll("label").length).toBe(documents.querySelectorAll("img[data-icon3d]").length);
  });

  it("신청 준비 — 서류 목록이 없으면 묶음 없이 확인 3줄, 그림 없음", () => {
    const policy = policies.find((p) => !p.documents)!;
    render(<ApplicationPreparation policy={policy} />);
    const list = screen.getByRole("region", { name: "신청 전 확인 목록" });
    expect(within(list).queryAllByRole("group")).toHaveLength(0);
    expect(within(list).getAllByRole("checkbox")).toHaveLength(3);
    expect(icons(list)).toEqual([]);
  });

  it("정책 상세 — 제목 위 64px 타일", () => {
    const policy = policies.find((p) => p.id === "iksan-newcomer-moving-cost-support")!;
    render(<PolicyDetail id={policy.id} />);
    const header = screen.getByRole("heading", { level: 1, name: policy.name }).closest("header")!;
    expect(icons(header)).toEqual(["moving"]);
    expect(header.querySelector("img")!.getAttribute("width")).toBe("64");
  });

  describe("지원금 목록", () => {
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-03T12:00:00+09:00"));
    });
    afterAll(() => vi.useRealTimers());

    it("카드마다 그 정책의 그림 40px — 이름과 같은 줄", async () => {
      saveAnswers({ birthDate: birthDateForAge(23), region: "전북특별자치도 익산시", status: "대학생", incomeBracket: 1, housingType: "월세" });
      render(<FindPoliciesPage />);
      const cards = (await screen.findAllByRole("link")).filter((a) => /^\/find\/policies\/[^/]+$/.test(a.getAttribute("href") ?? ""));
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        const id = card.getAttribute("href")!.split("/").pop();
        const policy = policies.find((p) => p.id === id)!;
        expect(icons(card), id).toEqual([policy.icon]);
        const row = within(card).getByRole("heading", { level: 3 }).closest("div")!.parentElement!;
        expect(icons(row)).toEqual([policy.icon]);
      }
    });
  });
});
