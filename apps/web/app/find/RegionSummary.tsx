import policiesJson from "@/data/policies.json";
import { policiesForRegion } from "@/lib/region";
import type { PolicyMeta } from "@/lib/types";

const policies = policiesJson as PolicyMeta[];

/**
 * /find 지역 단계에서 시군구를 고른 직후의 한 줄. 그 지역의 규모를 고르는 순간 알린다.
 * (11/17 지역 상담 창구 안내를 빼면서 ConsultCenters.tsx 에서 옮겼다 — 상담 창구 수도 더 붙이지 않는다.)
 */
export function RegionSummary({ region, label }: { region: string; label: string }) {
  const policyCount = policiesForRegion(policies, region).length;
  return (
    <p className="mb-2 text-center text-xs text-ink-500" aria-live="polite">
      {label} · 지원 정책 {policyCount}건
    </p>
  );
}
