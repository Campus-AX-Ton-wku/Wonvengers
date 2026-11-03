import consultCentersJson from "@/data/consult-centers.json";
import policiesJson from "@/data/policies.json";
import { Disclosure, telHref } from "@/app/components";
import { ICON_SM, Phone } from "@/app/components/icons";
import { consultCentersForRegion, policiesForRegion } from "@/lib/region";
import type { ConsultCenterMeta, PolicyMeta } from "@/lib/types";

const allCenters = consultCentersJson as ConsultCenterMeta[];
const policies = policiesJson as PolicyMeta[];

export const centersFor = (region: string) => consultCentersForRegion(allCenters, region);

/**
 * "이 지역에서 상담받을 수 있는 곳". 2026-10-23 멘토링: 지역을 고르면 상담 가능한
 * 연락처를 확인할 수 있어야 한다. 목록 위에 접어 둔다 — 혜택 카드보다 먼저 펼쳐져
 * 있으면 결과 화면의 주인공이 바뀐다.
 */
export default function ConsultCenters({ centers, regionLabel }: { centers: ConsultCenterMeta[]; regionLabel: string }) {
  if (centers.length === 0) return null;
  return (
    <Disclosure label={`${regionLabel}에서 상담받을 수 있는 곳 ${centers.length}곳`} className="mt-4">
      <ul className="flex flex-col gap-2">
        {centers.map((c) => (
          <li key={c.id} className="rounded-control bg-surface px-4 py-3 shadow-card">
            <p className="text-sm font-bold text-ink-900">{c.name}</p>
            {c.topics.length > 0 && <p className="mt-0.5 text-xs text-ink-500">{c.topics.join(" · ")}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
              {c.phone && (
                <a
                  href={telHref(c.phone)}
                  aria-label={`${c.name} 전화 ${c.phone}`}
                  className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control font-bold text-brand-700 underline"
                >
                  <Phone size={ICON_SM - 2} aria-hidden="true" />
                  {c.phone}
                </a>
              )}
              {c.hours && <span className="text-xs text-ink-500">{c.hours}</span>}
            </div>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

/** /find 지역 단계에서 시군구를 고른 직후의 한 줄. 그 지역의 규모를 고르는 순간 알린다. */
export function RegionSummary({ region, label }: { region: string; label: string }) {
  const policyCount = policiesForRegion(policies, region).length;
  const centerCount = centersFor(region).length;
  return (
    <p className="mb-2 text-center text-xs text-ink-500" aria-live="polite">
      {label} · 지원 정책 {policyCount}건{centerCount > 0 ? ` · 상담 창구 ${centerCount}곳` : ""}
    </p>
  );
}
