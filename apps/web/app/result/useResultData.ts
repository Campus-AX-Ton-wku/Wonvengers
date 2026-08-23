"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { todayISO } from "@/lib/date";

const policies = policiesData as PolicyMeta[];

/**
 * 결과 화면과 캡처용 요약 화면이 같은 입력·같은 기준일로 같은 결과를 쓰게 한다.
 * 두 화면이 각자 불러오면 요약과 상세의 숫자가 어긋날 수 있다.
 *
 * 입력이 없으면 홈으로 보낸다 — 계약 조건 없이 계산할 수 있는 값이 없다.
 */
export function useResultData() {
  const router = useRouter();
  // 기준일은 화면에 들어온 시점으로 고정한다. 렌더마다 새로 만들면 판정이 흔들린다.
  const [asOf] = useState(todayISO());
  const [saved, setSaved] = useState<{
    listing: ListingInput;
    profile: EligibilityProfile;
  } | null>(null);

  useEffect(() => {
    const listing = loadListing();
    const profile = loadProfile();
    if (!listing || !profile) {
      router.replace("/");
      return;
    }
    setSaved({ listing, profile });
  }, [router]);

  const summary: CalculationSummary | null = useMemo(() => {
    if (!saved) return null;
    // 판정질문 화면과 같은 후보 집합을 써야 한다. 여기서 지역 밖 정책을 같이 빼지 않으면
    // 묻지 않은 질문이 unknown 으로 남아 그 정책이 '조건충족시가능'으로 잘못 뜬다.
    const scoped = policiesForRegion(policies, saved.listing.region);
    return buildCalculationSummary(scoped, saved.profile, saved.listing, asOf);
  }, [saved, asOf]);

  return { listing: saved?.listing ?? null, summary, asOf };
}
