import { notFound } from "next/navigation";
import { AppShell, LinkButton, TopBar } from "@/app/components";
import { ChevronLeft, ChevronRight, ICON_MD, ICON_SM, MapPin, TriangleAlert } from "@/app/components/icons";
import { findGuide, GUIDES } from "@/lib/guides";

/** 정적 export — 모든 가이드의 모든 장을 미리 만든다. */
export function generateStaticParams() {
  return GUIDES.flatMap((g) => g.sections.map((_, i) => ({ id: g.id, step: String(i + 1) })));
}

/**
 * 가이드 한 장 (11/20 ggue — 노션처럼 한 페이지에 한 섹션). ← 는 목차(/guides/[id]).
 * 순서: 비유 제목 → 한 줄 할 일(굵게) → 본문 → 어디서 해요 → 조심해요 → 용어 풀이(정확한 뜻) → 이전 · 다음.
 * 출처 · 확인일은 목차 아래 한 곳에 둔다.
 */
export default async function GuideStepPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  const guide = findGuide(id);
  const n = Number(step);
  if (!guide || !Number.isInteger(n) || n < 1 || n > guide.sections.length) notFound();
  const section = guide.sections[n - 1];
  const total = guide.sections.length;
  const base = `/guides/${guide.id}`;

  return (
    <AppShell>
      <TopBar backHref={base} />
      <main className="flex flex-1 flex-col gap-5 pb-10 pt-2.5">
        <header className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-brand-700">
            {guide.title} · {n}/{total}
          </p>
          <h1 className="text-[26px] font-extrabold leading-[1.35] text-ink-900">{section.title}</h1>
          <p className="text-[17px] font-bold leading-relaxed text-ink-900">{section.lead}</p>
        </header>

        <div className="flex flex-col gap-3">
          {section.body.map((p) => (
            <p key={p} className="text-[15px] leading-[1.75] text-ink-700">
              {p}
            </p>
          ))}
        </div>

        {section.where && (
          <section aria-labelledby="guide-where" className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
            <h2 id="guide-where" className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
              <MapPin size={ICON_SM} aria-hidden="true" className="text-brand-600" />
              {section.whereLabel ?? "어디서 해요"}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {section.where.map((w) => (
                <li key={w} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-700">
                  <span aria-hidden="true" className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-brand-600" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {section.caution && (
          <p className="flex items-start gap-2.5 rounded-card bg-warn-50 p-4 text-[15px] leading-relaxed text-ink-700">
            <TriangleAlert size={ICON_MD} aria-hidden="true" className="mt-0.5 shrink-0 text-warn-800" />
            <span>
              <strong className="font-bold text-warn-800">조심해요 · </strong>
              {section.caution}
            </span>
          </p>
        )}

        {section.terms && (
          <section aria-labelledby="guide-terms" className="flex flex-col gap-2">
            <h2 id="guide-terms" className="text-sm font-bold text-ink-700">
              용어 풀이
            </h2>
            <dl className="flex flex-col gap-2.5 rounded-card border border-ink-200 p-4">
              {section.terms.map((t) => (
                <div key={t.term} className="flex flex-col gap-0.5">
                  <dt className="text-sm font-bold text-ink-900">{t.term}</dt>
                  <dd className="text-sm leading-relaxed text-ink-600">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <nav aria-label="장 이동" className="mt-auto flex gap-2 pt-4">
          {n > 1 && (
            <LinkButton href={`${base}/${n - 1}`} variant="secondary" size="md" className="flex-1">
              <ChevronLeft size={ICON_MD} aria-hidden="true" />
              이전
            </LinkButton>
          )}
          {n < total ? (
            <LinkButton href={`${base}/${n + 1}`} size="md" className="flex-1">
              다음
              <ChevronRight size={ICON_MD} aria-hidden="true" />
            </LinkButton>
          ) : (
            <LinkButton href={base} size="md" className="flex-1">
              목차로
            </LinkButton>
          )}
        </nav>
      </main>
    </AppShell>
  );
}
