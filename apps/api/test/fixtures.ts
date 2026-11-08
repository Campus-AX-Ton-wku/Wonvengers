import type { ApiEvent } from "../src/http";
import type { UserDataPayload } from "../../web/lib/user-data";

/** 두 사람. 카카오 회원번호는 username 의 숫자 부분이다(테스트 대역 AccountService 가 그렇게 읽는다). */
export const A = { sub: "11111111-1111-4111-8111-111111111111", username: "kakao_1001" };
export const B = { sub: "22222222-2222-4222-8222-222222222222", username: "kakao_2002" };

export function validPayload(overrides: Partial<UserDataPayload> = {}): UserDataPayload {
  return {
    schemaVersion: 1,
    answers: {
      values: {
        birthDate: "2002-03-14",
        region: "전북특별자치도 익산시",
        status: "대학생",
        incomeBracket: 1,
        housingType: "월세",
      },
      answeredKeys: ["birthDate", "region", "status", "incomeBracket", "housingType"],
    },
    listing: {
      region: "전북특별자치도 익산시",
      contractType: "월세",
      deposit: 3_000_000,
      rentOrYearlyAmount: 400_000,
      managementFee: 50_000,
      oneTimeMoveCost: 0,
      contractStartDate: "2026-03-01",
      months: 12,
      confirmedMatchesActualContract: true,
    },
    profile: {
      values: {
        birthDate: "2002-03-14",
        isStudentOrEmployed: "student",
        livesApartFromParents: true,
        canRegisterResidence: true,
        hasNoHouse: true,
        isContractHolder: true,
        householdSize: 1,
        useOriginHousehold: "unknown",
        ownHouseholdMonthlyIncome: 900_000,
        originHouseholdMonthlyIncome: "unknown",
        assetsUnder107M: true,
        isBasicLivelihoodRecipient: false,
        isNearPovertyClass: false,
        receivingOtherRentSupport: false,
        jeonbukResidentOverOneYear: "unknown",
        employedInTargetSectorOver3Months: "unknown",
      },
      answeredKeys: ["birthDate", "hasNoHouse"],
    },
    declared: { singleHousehold: true },
    checklists: {
      "iksan-newcomer-moving-cost-support": { eligibility: true, period: false, documents: false },
    },
    consentVersion: "2026-11-04",
    consentAt: "2026-11-04T09:00:00.000Z",
    ...overrides,
  };
}

/**
 * HTTP API(페이로드 2.0) 이벤트. claims 가 null 이면 authorizer 를 거치지 않은 요청이다.
 * 핸들러가 보는 칸만 채우고 나머지는 비운다.
 */
export function apiEvent(
  routeKey: string,
  claims: Record<string, string> | null,
  body?: unknown,
  opts: { raw?: string; base64?: boolean; query?: string } = {}
): ApiEvent {
  const text = opts.raw ?? (body === undefined ? undefined : JSON.stringify(body));
  return {
    version: "2.0",
    routeKey,
    rawPath: routeKey.split(" ")[1],
    rawQueryString: opts.query ?? "",
    headers: {},
    isBase64Encoded: opts.base64 ?? false,
    body: text === undefined ? undefined : opts.base64 ? Buffer.from(text, "utf8").toString("base64") : text,
    requestContext: {
      routeKey,
      authorizer: claims ? { jwt: { claims, scopes: null }, principalId: "", integrationLatency: 0 } : undefined,
    },
  } as unknown as ApiEvent;
}
