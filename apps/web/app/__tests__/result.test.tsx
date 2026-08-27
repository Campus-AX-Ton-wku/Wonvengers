// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ResultPage from "@/app/result/page";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * 결과 화면의 금액 표기와 강조 위계.
 *
 * 이 화면은 덱에 실리는 세 장 중 하나인데 UI 테스트가 없었다. QA체크리스트의
 * 결과 항목이 대부분 '직접 클릭' 으로 남아 있던 것과 같은 공백이다.
 *
 * 금액을 **자릿수가 아니라 표기 방식으로** 검증한다. 정확한 계산액은 판정 로직의
 * 몫이고(lib/__tests__/summary.test.ts), 여기서 볼 것은 "사용자가 어떤 형태로
 * 읽는가" 다. 계산 규칙이 바뀌어도 이 테스트는 깨지지 않아야 한다.
 */

/** 이사비 60만원 — 상한 50만원에 걸려 지원금이 0 이 아닌 값으로 나온다. */
function renderWithInput() {
  saveListing(makeListing({ oneTimeMoveCost: 600000 }));
  saveProfile(makeProfile());
  render(<ResultPage />);
}

/*
 * 카드 안의 라벨만 정확히 집는다. '최대 지원 가능액' 만으로 찾으면 h1 에도
 * 걸려 쿼리가 모호해진다. 카드 라벨은 뒤에 괄호가 붙는 것으로 구분한다.
 */
const 지원금_라벨 = /^최대 지원 가능액 \(/;
const 주거비_라벨 = /^최종 예상 주거비 \(/;

/*
 * 글씨 크기를 순위로 읽는다. 특정 클래스명(text-5xl)을 고정하면 크기를 조정할 때마다
 * 테스트가 깨지는데, 이 테스트가 지킬 것은 "지원금이 주거비보다 크다" 는 관계다.
 * (실제로 text-5xl 은 금액이 두 줄로 넘쳐 text-4xl 로 되돌렸다.)
 * jsdom 은 Tailwind 를 계산하지 않으므로 클래스명에서 순위를 뽑는다.
 */
const TEXT_SCALE = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];

function 글씨크기(el: HTMLElement): number {
  const hit = el.className.match(/text-(xs|sm|base|lg|\d?xl)\b/);
  if (!hit) throw new Error(`글씨 크기 클래스를 찾지 못했다: ${el.className}`);
  return TEXT_SCALE.indexOf(hit[1]);
}

/** 라벨 바로 다음 형제가 금액이다. */
function amountAfter(labelPattern: RegExp): HTMLElement {
  const label = screen.getByText(labelPattern);
  const amount = label.nextElementSibling;
  if (!amount) throw new Error(`${labelPattern} 다음에 금액 요소가 없다`);
  return amount as HTMLElement;
}

/*
 * 원 단위 전체 자릿수. '21만 2,000원' 의 '2,000원' 은 만 단위 뒤의 나머지라
 * 정상이므로, 콤마 앞에 세 자리가 오는 경우만 잡는다 — formatKoreanMoney 는
 * 그런 문자열을 만들지 않는다.
 */
const 원단위_전체자릿수 = /\d{3},\d{3}원/;

describe("금액 표기", () => {
  it("최대 지원 가능액을 만 단위로 읽어준다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(amountAfter(지원금_라벨).textContent).toMatch(/만/);
  });

  it("최종 예상 주거비도 만 단위로 읽어준다", async () => {
    renderWithInput();
    await screen.findByText(주거비_라벨);

    expect(amountAfter(주거비_라벨).textContent).toMatch(/만/);
  });

  /*
   * 목록 화면은 '480만원' 인데 결과 카드는 '500,000원' 이었다. 같은 금액을 두
   * 방식으로 읽게 하지 않는다 — 휠 피커에서 날짜 UI 를 하나로 모은 것과 같은 이유다.
   *
   * 금액 카드 안으로 범위를 좁힌다. 정책 카드의 **산식**은 원 단위로 남긴다 —
   * 그 줄의 목적은 공고 원문과 대조하는 검산이고, 공고가 원 단위로 적혀 있다
   * (lib/benefit.ts 의 benefitFormula, lib/__tests__/benefit.test.ts 가 고정).
   */
  it("금액 카드에 원 단위 전체 자릿수를 남기지 않는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    const 카드 = screen.getByText(지원금_라벨).closest("section");
    if (!카드) throw new Error("금액 카드를 찾지 못했다");
    const 원단위 = within(카드 as HTMLElement).queryAllByText(원단위_전체자릿수);
    expect(원단위.map((el) => el.textContent)).toEqual([]);
  });

  /* 캡처에 함께 들어오는 금액이라 카드와 표기가 갈리면 그 자리에서 보인다. */
  it("계약 당일 필요한 현금도 만 단위로 읽어준다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    const 현금 = screen.getByText(/계약 당일 필요한 현금/);
    expect(현금.textContent).not.toMatch(원단위_전체자릿수);
  });
});

describe("강조 위계", () => {
  /*
   * 받는 돈과 내는 돈이 같은 text-3xl 이었다. 색만 달랐고, 자릿수가 하나 더 많은
   * 지출액이 시각적으로 압도했다 — 자릿수가 색을 이긴다. 지원금 서비스의 대표
   * 캡처에서 먼저 읽히는 숫자가 지출액이면 안 된다.
   */
  it("지원금이 주거비보다 큰 글씨다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(글씨크기(amountAfter(지원금_라벨))).toBeGreaterThan(글씨크기(amountAfter(주거비_라벨)));
  });

  it("지원금만 accent 색을 쓴다 — 이 색이 '받는 돈' 신호다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(amountAfter(지원금_라벨).className).toContain("accent");
    expect(amountAfter(주거비_라벨).className).not.toContain("accent");
  });

  /*
   * h1 이 바로 아래 카드와 같은 두 라벨을 반복했다 ('최대 지원 가능액과 /
   * 최종 예상 주거비예요'). 캡처 한 장에서 같은 말이 두 번 나오고 화면 상단을
   * 두 줄이 먹었다.
   */
  it("제목이 카드의 라벨을 반복하지 않는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).not.toMatch(/최대 지원 가능액/);
    expect(h1.textContent).not.toMatch(/최종 예상 주거비/);
  });

  /*
   * app/page.tsx 의 MAX_BENEFIT 주석이 정한 태도와 같다 — 확정되지 않은 금액을
   * 가장 큰 약속으로 쓰지 않는다. 제목에 금액이 들어가면 그 약속이 된다.
   */
  it("제목에 금액을 넣지 않는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/\d/);
  });
});
