// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResultPage from "@/app/result/page";
import { saveListing, saveProfile } from "@/lib/storage";
import { makeListing, makeProfile } from "@/lib/__tests__/fixtures";
import { routerMock } from "./navigation-mock";
import loanProductsData from "@/data/loan-products.json";
import { loanProductsForRegion } from "@/lib/region";
import type { LoanProductMeta } from "@/lib/types";

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
const 지원금_라벨 = /^받을 수 있는 지원$/;
const 주거비_라벨 = /^최종 예상 주거비$/;

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

  /* 11/20 ggue: 계약하는 사람은 보증금을 당일 낸다는 걸 이미 안다 — '계약 당일 필요한 현금' 줄을 뺐다. */
  it("계약 당일 필요한 현금(보증금) 줄을 두지 않는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(screen.queryByText(/계약 당일 필요한 현금/)).toBeNull();
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

  it("받는 돈만 남색(brand-900)으로 강조한다 — 실제 부담은 잉크색 (11/20 금색 → 남색)", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(amountAfter(지원금_라벨).className).toContain("text-brand-900");
    expect(amountAfter(주거비_라벨).className).not.toContain("brand");
    // 금색은 금액에서 뺐다 — 결과 화면 어디에도 남지 않는다
    expect(document.querySelector('[class*="accent-"]')).toBeNull();
  });

  it("요약 카드 — 제목 위 '맞춤 혜택 결과', 금액 옆 개월 칩, 찾은 Perky 하나, 영수증은 '12개월 동안 내 주거비' 상자", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(screen.getByText("맞춤 혜택 결과")).toBeTruthy();
    expect(screen.getByText(지원금_라벨).textContent).toMatch(/개월 기준$/);
    expect(document.querySelectorAll("[data-pose]")).toHaveLength(1);
    expect(document.querySelector("[data-pose]")?.getAttribute("data-pose")).toBe("found");
    expect(screen.getByText(/^\d+개월 동안 내 주거비$/)).toBeTruthy();
    expect(screen.getByText(/^지원을 빼고 실제로 낼 돈 · 매달 약 /)).toBeTruthy();
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
  it("제목에는 결과 건수만 넣고 금액 약속은 넣지 않는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/[만원억,]/);
  });
});

describe("결과 카드 묶음 — 합계 안 / 밖 (11/18 진단 2회차 P1)", () => {
  it("위 금액에 넣은 지원과 조건이 맞으면 더 받을 수 있는 지원을 보이는 제목으로 나누고, 공통 설명은 한 번만", async () => {
    saveListing(makeListing({ region: "전북특별자치도 익산시", contractType: "월세", rentOrYearlyAmount: 350000, oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    const counted = screen.getByRole("region", { name: /^위 금액에 넣은 지원 \d+개$/ });
    const extra = screen.getByRole("region", { name: /^조건이 맞으면 더 받을 수 있는 지원 \d+개$/ });
    expect(within(counted).getAllByRole("article").length).toBeGreaterThan(0);
    expect(within(extra).getAllByRole("article").length).toBeGreaterThan(0);
    expect(within(extra).getAllByText(/위 금액에는 넣지 않았어요/)).toHaveLength(1);
  });
});

describe("돈 요약 영수증 (11/18 — 헤더 · 요약 · 조합 · 목돈 카드를 한 장으로)", () => {
  function 요약카드(): HTMLElement {
    const card = screen.getByText(지원금_라벨).closest("section");
    if (!card) throw new Error("요약 카드를 찾지 못했다");
    return card as HTMLElement;
  }

  it("한 카드 안에서 내는 돈 − 받는 지원 = 실제 부담을 줄로 보여 주고, 한 달 부담도 적는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);
    const card = 요약카드();

    expect(within(card).getByText(/^월세·관리비 \d+개월$/)).toBeTruthy();
    // 이사비는 11/21 부터 묻지 않는다 — 저장된 60만원이 있어도 읽을 때 0 이라 이사비 줄이 없다
    expect(within(card).queryByText("이사비")).toBeNull();
    // 받는 지원은 합계에 든 정책 이름과 빼는 금액으로 — 어떤 지원을 더했는지(F4-5)가 접히지 않고 보인다
    const supportRows = within(card).getAllByText(/^− .+원$/);
    expect(supportRows.length).toBeGreaterThan(0);
    expect(supportRows[0].closest("details")).toBeNull();
    expect(within(card).getByText(/^지원을 빼고 실제로 낼 돈 · 매달 약 .+원/)).toBeTruthy();
  });

  it("조합 · 목돈을 따로 카드로 두지 않고, 제목 아래 금액 줄도 반복하지 않는다", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    expect(screen.queryByText("이 금액은 아래 조합으로 계산했습니다")).toBeNull();
    expect(screen.queryByText("계약 시 필요한 목돈과 지급 시점은 달라요")).toBeNull();
    expect(screen.queryByText(/받을 수 있어요$/)).toBeNull();
  });
});

/**
 * 대출 · 보증은 11/22 부터 홈 '대출 · 보증' · /loans 가 맡는다. 결과 화면엔 개수와 '합계에 안 넣었다'는 한 줄 링크만.
 * 개수는 계약 지역으로 거른 수다(loanProductsForRegion) — 지역 거르기 회귀는 lib/__tests__/region.test.ts · loans.test.ts 가 본다.
 */
describe("대출·보증 상품 — 한 줄 링크 (11/22)", () => {
  const allLoans = loanProductsData as LoanProductMeta[];

  it("/loans 로 가는 한 줄 — 개수 · '위 금액에는 넣지 않았어요' · 3D 대출 그림, 상품은 펼치지 않는다", async () => {
    saveListing(makeListing({ region: "전북특별자치도 익산시" }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    const n = loanProductsForRegion(allLoans, "전북특별자치도 익산시").length;
    const link = screen.getByRole("link", { name: new RegExp(`현금 지원이 아닌 대출·보증 ${n}개`) });
    expect(link.getAttribute("href")).toBe("/loans");
    expect(within(link).getByText("위 금액에는 넣지 않았어요")).toBeTruthy();
    expect([...link.querySelectorAll("img[data-icon3d]")].map((img) => img.getAttribute("data-icon3d"))).toEqual(["loan"]);
    expect(screen.queryByText("청년전용 버팀목 전세자금대출")).toBeNull();
    expect(screen.queryByRole("link", { name: /신청 페이지로 이동/ })).toBeNull();
  });

  it("개수는 계약 지역으로 거른 수 — 익산 밖이면 전국 상품만 센다", async () => {
    for (const region of ["전북특별자치도 익산시", "그 외 지역"] as const) {
      saveListing(makeListing({ region }));
      saveProfile(makeProfile());
      const { unmount } = render(<ResultPage />);
      await screen.findByText(지원금_라벨);
      const n = loanProductsForRegion(allLoans, region).length;
      expect(screen.getByRole("link", { name: new RegExp(`대출·보증 ${n}개`) })).toBeTruthy();
      unmount();
    }
  });
});

/**
 * "저가 주택 공급 안내" 섹션은 2026-11-15 에 뺐다(목표 지역 익산시 — 익산 사용자에게 보이던 건
 * 고양시 대학생 연합생활관 하나뿐이었다). 다시 생기지 않는지, 지원금 계산이 그대로인지 본다.
 */
describe("저가 주택 공급 안내 — 삭제됨", () => {
  it("결과 화면에 저가 주택 공급 섹션이 없다", async () => {
    saveListing(makeListing({ region: "전북특별자치도 익산시", oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(screen.queryByText(/저가 주택 공급 안내/)).toBeNull();
    expect(screen.queryByText("대학생 연합생활관(은행권,고양)")).toBeNull();
  });

  it("최대 지원 가능액은 그대로다 — 청년 주거급여 분리지급 월 21만 2천원 × 12개월", async () => {
    // 익산 이사비 50만원은 2026-05-14 예산 소진 마감이라 조합에서 빠진다. 2026-11-15 에 넣은 익산 전입 지원
    // 2건은 정액이라 예상액 0원 — 조합 금액을 바꾸지 않는다.
    saveListing(makeListing({ oneTimeMoveCost: 600000 }));
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    expect(amountAfter(지원금_라벨).textContent).toMatch(/254만 4,000원/);
  });
});

describe("결과 화면 하단", () => {
  it("'다른 방으로 다시 계산하기'는 계약 조건 첫 단계로 간다 — 월세만 바꿔 다시 볼 수 있다 (11/19)", async () => {
    renderWithInput();
    await userEvent.setup().click(await screen.findByRole("button", { name: "다른 방으로 다시 계산하기" }));

    expect(routerMock.push).toHaveBeenCalledWith("/calculate?s=1");
  });

  it("고지문은 해요체이고, 기준일은 다른 날짜와 같은 점 표기다 (11/19)", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    const notice = screen.getByText(/조건을 모두 충족했을 때의 상한이에요/);
    expect(notice.textContent).not.toMatch(/니다/);
    expect(notice.textContent).toMatch(/결과 기준일 \d{4}\.\d{2}\.\d{2}/);
  });

  it("금액 바로 아래에 '최종 금액은 기관이 정한다'는 짧은 고지가 있다 (11/19)", async () => {
    renderWithInput();
    await screen.findByText(지원금_라벨);

    const card = screen.getByText(지원금_라벨).closest("section") as HTMLElement;
    expect(within(card).getByText("최종 금액은 각 기관이 심사해 정해요")).toBeTruthy();
  });

  it("'답변 수정하기' 는 판정 질문 첫 묶음 주소로 간다 — 화살표(뒤로)와 목적지가 다르다", async () => {
    renderWithInput();
    await userEvent.setup().click(await screen.findByRole("button", { name: "답변 수정하기" }));

    expect(routerMock.push).toHaveBeenCalledWith("/eligibility?g=1");
  });
});

/** 전세 계산 (11/23 ggue A안) — 영수증은 '대출 이자·관리비', 월세 상한 지원은 이자로 세지 않는다. */
describe("결과 — 전세 계약", () => {
  it("영수증 첫 줄이 대출 이자·관리비이고, 금액이 (이자 + 관리비) × 개월이다", async () => {
    saveListing(
      makeListing({
        contractType: "전세",
        deposit: 100_000_000,
        rentOrYearlyAmount: 0,
        jeonseLoanAmount: 80_000_000,
        jeonseLoanRate: 2.4,
        managementFee: 40_000,
        months: 24,
      })
    );
    saveProfile(makeProfile());
    render(<ResultPage />);
    await screen.findByText(지원금_라벨);

    const label = screen.getByText(/^대출 이자·관리비 24개월$/);
    // (16만 + 4만) × 24 = 480만
    expect(label.nextElementSibling?.textContent).toBe("480만원");
    expect(screen.queryByText(/^월세·관리비/)).toBeNull();
  });
});

/**
 * 11/23 ggue 실기기: 원가구 소득을 '모름'으로 답했는데 청년 주거급여 분리지급 254만 4,000원이 맨 위 큰 숫자에 들어가고,
 * 밑에 '이 금액에는 아직 확인되지 않은 조건이 들어 있어요'가 붙었다. 확인하지 않은 금액은 합계에 넣지 않는다.
 */
describe("결과 — 확인할 조건이 남은 지원은 합계 밖", () => {
  function 원가구소득모름() {
    saveListing(makeListing({ contractType: "월세", rentOrYearlyAmount: 350_000, managementFee: 50_000, months: 12 }));
    saveProfile(makeProfile({ originHouseholdMonthlyIncome: "unknown" }));
    render(<ResultPage />);
  }

  it("맨 위 금액에 넣지 않고, 바로 밑에 '조건을 확인하면 최대 +254만 4,000원'", async () => {
    원가구소득모름();
    await screen.findByText(지원금_라벨);
    expect(amountAfter(지원금_라벨).textContent).not.toBe("254만 4,000원");
    expect(screen.getByText("조건을 확인하면 최대 +254만 4,000원")).toBeTruthy();
    expect(screen.queryByText("이 금액에는 아직 확인되지 않은 조건이 들어 있어요")).toBeNull();
    expect(screen.getByText(/이 조건을 확인하면 최대 254만 4,000원을 더 받을 수 있어요/)).toBeTruthy();
    expect(screen.getByText(/\[청년 주거급여 분리지급\] 원가구 소득/)).toBeTruthy();
  });

  it("영수증 '받는 지원'에도 없고, 카드는 '조건이 맞으면 더 받을 수 있는 지원'에 — 합계에 안 넣은 이유와 함께", async () => {
    원가구소득모름();
    await screen.findByText(지원금_라벨);
    const card = screen.getByText(주거비_라벨).closest("section") as HTMLElement;
    expect(within(card).queryByText("청년 주거급여 분리지급")).toBeNull();
    const extra = screen.getByRole("region", { name: /조건이 맞으면 더 받을 수 있는 지원/ });
    expect(within(extra).getByRole("heading", { name: "청년 주거급여 분리지급" })).toBeTruthy();
    expect(within(extra).getByText("확인할 조건이 남아 위 합계에는 넣지 않았어요")).toBeTruthy();
  });
});
