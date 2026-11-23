import type { HousingNotice, NoticeSnapshot } from "../../../web/lib/notices";
import type { PolicyMeta } from "../../../web/lib/types";

/**
 * 배포된 정식 앱의 /policies.json (apps/web/app/policies.json/route.ts). DB 가 아니라 앱에 실린 목록을 본다 —
 * 앱에 없는 정책을 알리지 않기 위해서다. 10초 안에 오지 않거나 모양이 틀리면 던진다(그 회차는 건너뛴다).
 */
export async function fetchPublishedPolicies(url: string, fetchImpl: typeof fetch = fetch): Promise<PolicyMeta[]> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`policies.json ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error("policies.json is not an array");
  for (const item of body) {
    const p = item as Partial<PolicyMeta>;
    if (typeof p?.id !== "string" || typeof p.name !== "string" || typeof p.discovery !== "object" || p.discovery === null) {
      throw new Error("policies.json has a malformed item");
    }
  }
  return body as PolicyMeta[];
}

/**
 * 배포된 /notices.json (apps/web/app/notices.json/route.ts) — 받은 시각과 목록. 모양이 틀리면 던진다(그 회차 공고 알림만 건너뛴다).
 * 받은 시각(generatedAt)이 null 이면 빌드 때 못 받은 빈 스냅숏이다 — 부르는 쪽이 기준선으로 삼지 않는다(리뷰 I-1).
 */
export async function fetchPublishedNotices(url: string, fetchImpl: typeof fetch = fetch): Promise<NoticeSnapshot> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`notices.json ${res.status}`);
  const body = (await res.json()) as { generatedAt?: unknown; notices?: unknown };
  if (!body || !Array.isArray(body.notices)) throw new Error("notices.json has no notices array");
  if (body.generatedAt !== null && typeof body.generatedAt !== "string") throw new Error("notices.json has a malformed generatedAt");
  for (const item of body.notices) {
    const n = item as Partial<HousingNotice>;
    if (typeof n?.id !== "string" || typeof n.title !== "string" || typeof n.url !== "string") throw new Error("notices.json has a malformed item");
  }
  return { generatedAt: body.generatedAt, notices: body.notices as HousingNotice[] };
}
