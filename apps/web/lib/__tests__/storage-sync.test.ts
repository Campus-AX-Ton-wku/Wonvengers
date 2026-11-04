// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_CHECKLIST,
  clearLocalContent,
  loadChecklist,
  loadProfile,
  onLocalChange,
  readLocalContent,
  resetAllAnswers,
  saveAnswers,
  saveAnsweredKeys,
  saveChecklist,
  saveDeclared,
  saveEligibilityAnsweredKeys,
  saveListing,
  saveProfile,
  writeLocalContent,
} from "@/lib/storage";
import { emptyContent, type UserDataContent } from "@/lib/user-data";
import type { EligibilityProfile, ListingInput } from "@/lib/types";

const 답 = {
  birthDate: "2002-03-14",
  region: "전북특별자치도 익산시",
  status: "대학생" as const,
  incomeBracket: 1,
  housingType: "월세" as const,
};
const 계약: ListingInput = {
  region: "전북특별자치도 익산시",
  contractType: "월세",
  deposit: 3_000_000,
  rentOrYearlyAmount: 400_000,
  managementFee: 50_000,
  oneTimeMoveCost: 0,
  contractStartDate: "2026-03-01",
  months: 12,
  confirmedMatchesActualContract: true,
};
const 자격: EligibilityProfile = {
  birthDate: "2002-03-14",
  isStudentOrEmployed: "student",
  livesApartFromParents: true,
  canRegisterResidence: "unknown",
  hasNoHouse: true,
  isContractHolder: true,
  householdSize: 1,
  useOriginHousehold: "unknown",
  ownHouseholdMonthlyIncome: 900_000,
  originHouseholdMonthlyIncome: "unknown",
  assetsUnder107M: "unknown",
  isBasicLivelihoodRecipient: false,
  isNearPovertyClass: false,
  receivingOtherRentSupport: false,
  jeonbukResidentOverOneYear: "unknown",
  employedInTargetSectorOver3Months: "unknown",
};
const 정책 = "iksan-newcomer-moving-cost-support";

function 전부저장(): void {
  saveAnswers(답);
  saveAnsweredKeys(["birthDate", "region", "status", "incomeBracket", "housingType"]);
  saveListing(계약);
  saveProfile({ ...자격, selfDeclared: { singleHousehold: true } });
  saveEligibilityAnsweredKeys(["hasNoHouse"]);
  saveDeclared("singleHousehold", true);
  saveChecklist(정책, { eligibility: true, period: false, documents: false });
}

const 기대: UserDataContent = {
  answers: { values: 답, answeredKeys: ["birthDate", "region", "status", "incomeBracket", "housingType"] },
  listing: 계약,
  profile: { values: 자격, answeredKeys: ["hasNoHouse"] },
  declared: { singleHousehold: true },
  checklists: { [정책]: { eligibility: true, period: false, documents: false } },
};

describe("이 기기의 사본 — 일곱 갈래 키를 한 묶음으로", () => {
  it("읽기: 프로필 안의 옛 selfDeclared 는 빼고, 직접 답한 조건은 따로 담는다", () => {
    전부저장();
    expect(readLocalContent()).toEqual(기대);
  });

  it("쓰기 → 읽기가 같고, 묶음에 없는 체크리스트는 지운다", () => {
    saveChecklist("other-policy", { eligibility: true, period: true, documents: true });
    writeLocalContent(기대);
    expect(readLocalContent()).toEqual(기대);
    expect(loadChecklist("other-policy")).toEqual(EMPTY_CHECKLIST);
    expect(loadProfile()?.selfDeclared).toEqual({ singleHousehold: true });
  });

  it("깨진 묶음만 버린다 — 계약 조건이 깨져도 1층 답은 남는다", () => {
    전부저장();
    window.localStorage.setItem("housing-benefit:listing", JSON.stringify({ ...계약, deposit: "많이" }));
    const content = readLocalContent();
    expect(content.listing).toBeNull();
    expect(content.answers).toEqual(기대.answers);
  });

  it("답한 질문 기록의 모르는 키·중복은 걸러서 읽는다", () => {
    saveAnsweredKeys(["birthDate", "birthDate", "age" as never]);
    expect(readLocalContent().answers.answeredKeys).toEqual(["birthDate"]);
  });

  it("비우기는 일곱 갈래만 지우고 온보딩·로그인·동의·가입 시트 기록은 남긴다", () => {
    전부저장();
    for (const key of ["perky.onboarded", "perky.auth", "perky.consent", "perky.signup-dismissed"]) {
      window.localStorage.setItem(key, "1");
    }
    clearLocalContent();
    expect(readLocalContent()).toEqual(emptyContent());
    const left: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) left.push(window.localStorage.key(i)!);
    expect(left.sort()).toEqual(["perky.auth", "perky.consent", "perky.onboarded", "perky.signup-dismissed"]);
  });

  it("체크리스트는 정책마다 perky.application-checklist:<id> 에 있다", () => {
    expect(loadChecklist(정책)).toEqual(EMPTY_CHECKLIST);
    saveChecklist(정책, { eligibility: true, period: true, documents: false });
    expect(JSON.parse(window.localStorage.getItem(`perky.application-checklist:${정책}`)!)).toEqual({
      eligibility: true,
      period: true,
      documents: false,
    });
  });
});

describe("바뀜 알림 — lib/sync.ts 가 듣는다", () => {
  it("save* 는 알리고, 서버 값으로 덮어쓰기·비우기는 알리지 않고, '처음부터 다시'는 바로 알린다", () => {
    const listener = vi.fn();
    const stop = onLocalChange(listener);

    전부저장();
    expect(listener).toHaveBeenCalledTimes(7);
    expect(listener.mock.calls.every(([change]) => change.immediate === false)).toBe(true);

    listener.mockClear();
    writeLocalContent(기대);
    clearLocalContent();
    expect(listener).not.toHaveBeenCalled();

    resetAllAnswers();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ immediate: true });
    stop();
  });
});

describe("바뀐 것이 없으면 알리지 않는다 — /find 마운트처럼 같은 값을 다시 적는 화면이 있다", () => {
  it("save* 를 같은 값으로 두 번 부르면 처음 한 번만 알린다", () => {
    const listener = vi.fn();
    const stop = onLocalChange(listener);
    전부저장();
    expect(listener).toHaveBeenCalledTimes(7);
    listener.mockClear();

    전부저장();
    expect(listener).not.toHaveBeenCalled();

    saveAnswers({ ...답, housingType: null });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});

