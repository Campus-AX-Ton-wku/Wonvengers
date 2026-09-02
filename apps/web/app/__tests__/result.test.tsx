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

/**
 * "이용 가능한 대출·보증 상품" 섹션이 loan-products.json 을 지역 구분 없이
 * 통째로 보여주던 버그의 회귀 테스트. lib/__tests__/region.test.ts 의
 * loanProductsForRegion 단위 테스트와 짝이다 — 여기서는 실제 데이터
 * (data/loan-products.json)로 화면에 실제로 걸러져 나오는지까지 본다.
 */
describe("대출·보증 상품 — 지역 필터", () => {
  it("익산 사용자에게는 익산 전용 대출상품이 보인다", async () => {
    saveListing(makeListing({ region: "전북특별자치도 익산시", oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(screen.getByText("신혼부부·청년 주택구입 대출이자 지원사업")).toBeTruthy();
  });

  it("익산과 무관한 지역 사용자에게는 익산·군산 전용 대출상품이 안 보인다", async () => {
    saveListing(makeListing({ region: "그 외 지역", oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(screen.queryByText("신혼부부·청년 주택구입 대출이자 지원사업")).toBeNull();
    expect(screen.queryByText("신혼부부 주거자금 대출이자 지원사업")).toBeNull();
  });

  it("전국 대출상품(버팀목 전세자금대출 등)은 지역과 무관하게 항상 보인다 — 여기서 회귀가 나면 안 된다", async () => {
    for (const region of ["전북특별자치도 익산시", "전북특별자치도", "그 외 지역"] as const) {
      saveListing(makeListing({ region, oneTimeMoveCost: 600000 }));
      saveProfile(makeProfile());
      const { unmount } = render(<ResultPage />);
      await screen.findByText(지원금_라벨);

      expect(screen.getByText("청년전용 버팀목 전세자금대출")).toBeTruthy();
      unmount();
    }
  });
});

/**
 * "저가 주택 공급 안내" 섹션 — loan-products.json 과 같은 지역 필터 회귀 테스트.
 * data/housing-supply.json 의 실제 두 항목(전주 청춘★별채 = 전북특별자치도
 * 전주시 전용, 대학생 연합생활관 = 전국)으로 확인한다.
 */
describe("저가 주택 공급 안내 — 지역 필터", () => {
  it("전주 사용자에게는 청춘★별채가 보인다", async () => {
    saveListing(makeListing({ region: "전북특별자치도 전주시", oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(screen.getByText("2026년 전주 청년만원주택 청춘★별채 예비입주자 모집")).toBeTruthy();
  });

  it("전주와 무관한 지역 사용자에게는 청춘★별채가 안 보인다", async () => {
    saveListing(makeListing({ region: "그 외 지역", oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(screen.queryByText("2026년 전주 청년만원주택 청춘★별채 예비입주자 모집")).toBeNull();
  });

  it("전국 공급(대학생 연합생활관)은 지역과 무관하게 항상 보인다", async () => {
    for (const region of ["전북특별자치도 익산시", "전북특별자치도 전주시", "그 외 지역"] as const) {
      saveListing(makeListing({ region, oneTimeMoveCost: 600000 }));
      saveProfile(makeProfile());
      const { unmount } = render(<ResultPage />);
      await screen.findByText(지원금_라벨);

      expect(screen.getByText("대학생 연합생활관(은행권,고양)")).toBeTruthy();
      unmount();
    }
  });

  it("이 섹션은 지원금을 계산하지 않는다 — 최대 지원 가능액이 기존 계산과 같다", async () => {
    // 기본 지역(익산시)에서는 전국 공급(대학생 연합생활관)이 함께 보이면서도
    // "이 금액은 아래 조합으로 계산했습니다" 항목엔 여전히 정책 두 개(익산시
    // 전입 청년 이사비 50만원 · 청년 주거급여 분리지급)만 잡혀야 한다 —
    // 저가 주택 공급이 조용히 합산되면 이 조합에 세 번째 항목이 늘어난다.
    saveListing(makeListing({ oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(screen.getByText("대학생 연합생활관(은행권,고양)")).toBeTruthy();
    const 조합카드 = screen.getByText("이 금액은 아래 조합으로 계산했습니다").closest("section");
    if (!조합카드) throw new Error("조합 카드를 찾지 못했다");
    expect(within(조합카드 as HTMLElement).queryByText("대학생 연합생활관(은행권,고양)")).toBeNull();
    expect(amountAfter(지원금_라벨).textContent).toMatch(/304만/);
  });
});
