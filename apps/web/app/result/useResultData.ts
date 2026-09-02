"use client";

import { useEffect, useMemo, useState } from "react";
import policiesData from "@/data/policies.json";
import type {
  CalculationSummary,
  EligibilityProfile,
  ListingInput,
  PolicyMeta,
} from "@/lib/types";
import { buildCalculationSummary } from "@/lib/summary";
import { loadListing, loadProfile } from "@/lib/storage";
import { policiesForRegion } from "@/lib/region";
import { isExpiredResult, resultAvailability } from "@/lib/benefit-result";

const policies = policiesData as PolicyMeta[];

/**
 * 결과 화면과 캡처용 요약 화면이 같은 입력·같은 기준일로 같은 결과를 쓰게 한다.
 * 두 화면이 각자 불러오면 요약과 상세의 숫자가 어긋날 수 있다.
 *
 * 입력이 없으면 status: "missing" 을 준다. 예전에는 홈으로 튕겼는데, 결과 화면은
 * 링크로 공유되고 북마크되므로 튕기면 사용자가 뭘 잘못했는지 모른 채 랜딩에 선다.
 */
export function useResultData() {
  // 기준일은 서울 달력 날짜로 화면 진입 시 한 번만 고정한다.
  const [asOf] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  );
  const [saved, setSaved] = useState<{
    listing: ListingInput;
    profile: EligibilityProfile;
  } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const listing = loadListing();
    const profile = loadProfile();
    if (!listing || !profile) {
      setStatus("missing");
      return;
    }
    setSaved({ listing, profile });
    setStatus("ready");
  }, [revision]);

  const calculation = useMemo((): { summary: CalculationSummary | null; error: boolean } => {
    if (!saved) return { summary: null, error: false };
    // 판정질문 화면과 같은 후보 집합을 써야 한다. 여기서 지역 밖 정책을 같이 빼지 않으면
    // 묻지 않은 질문이 unknown 으로 남아 그 정책이 '조건충족시가능'으로 잘못 뜬다.
    try {
      const scoped = policiesForRegion(policies, saved.listing.region);
      return { summary: buildCalculationSummary(scoped, saved.profile, saved.listing, asOf), error: false };
    } catch {
      // localStorage 값이 구 버전이거나 손상돼도 결과 화면에서 죽지 않게 상태로 보낸다.
      return { summary: null, error: true };
    }
  }, [saved, asOf]);

  const summary = calculation.summary;
  const resolvedStatus =
    status !== "ready" ? status :
    calculation.error ? "error" :
    !summary ? "empty" :
    resultAvailability(summary, asOf);

  // 전부 마감된 경우 화면에 보여줄 실제 종료일. 가장 최근 회차를 대표값으로 쓴다.
  // 값이 없으면 UI 가 임의 날짜를 만들지 않고 "종료일 정보 없음"으로 안내한다.
  const expiredAt = summary?.results
    .filter((result) => isExpiredResult(result, asOf))
    .map((result) => result.policy.applicationEnd)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1) ?? null;

  const retry = () => {
    setStatus("loading");
    setSaved(null);
    setRevision((value) => value + 1);
  };

  return { listing: saved?.listing ?? null, summary, asOf, status: resolvedStatus, expiredAt, retry };
}
