import policiesJson from "@/data/policies.json";
import PolicyDetail from "./PolicyDetail";
import type { PolicyMeta } from "@/lib/types";

/**
 * 1층 · 발견 — 정책 상세.
 *
 * 목록의 카드는 "무엇을 얼마까지" 만 말한다. 공고 문구·요건·신청 기간·출처는
 * 전부 여기 있다. 예전에는 이것들이 카드마다 토글로 붙어 목록을 끊어 놨다.
 *
 * 정적 export(next.config.ts) 라서 정책 수만큼 페이지를 미리 만든다. 정책은
 * 다섯 개짜리 JSON 이고 빌드 때 이미 손에 있다.
 */

const policies = policiesJson as PolicyMeta[];

export function generateStaticParams() {
  return policies.map((p) => ({ id: p.id }));
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PolicyDetail id={id} />;
}
