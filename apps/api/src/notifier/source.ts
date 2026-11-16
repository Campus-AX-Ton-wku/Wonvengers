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
