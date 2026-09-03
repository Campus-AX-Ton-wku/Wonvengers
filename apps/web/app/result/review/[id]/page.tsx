import { notFound } from "next/navigation";
import policiesJson from "@/data/policies.json";
import type { PolicyMeta } from "@/lib/types";
import RequirementReview from "./RequirementReview";

const policies = policiesJson as PolicyMeta[];

export function generateStaticParams() {
  return policies.map((policy) => ({ id: policy.id }));
}

export default async function RequirementReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const policy = policies.find((item) => item.id === id);
  if (!policy) notFound();

  return <RequirementReview policy={policy} />;
}
