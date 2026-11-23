import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, buttonClass, TopBar } from "@/app/components";
import { ExternalLink, ICON_MD, ICON_SM, MapPin, TriangleAlert } from "@/app/components/icons";
import { findGuide, GUIDES } from "@/lib/guides";
import { StepNav } from "./StepNav";
import { MarkGuideRead } from "./MarkGuideRead";

/** 정적 export — 모든 가이드의 모든 장을 미리 만든다. */
export function generateStaticParams() {
  return GUIDES.flatMap((g) => g.sections.map((_, i) => ({ id: g.id, step: String(i + 1) })));
}

/**
 * 가이드 한 장 (11/20 ggue — 노션처럼 한 페이지에 한 섹션). ← 는 목차(/guides/[id]) — 장 넘기기가 기록을 안 쌓아서 늘 목차다.
 * 순서: 용어 · 몇 번째 장 → 제목 → 한 줄 할 일(굵게) → 본문 → 어디서 해요 → 조심해요 → 용어 풀이(정확한 뜻) → 이전 · 다음.
 * 윗줄은 11/21 ggue 결정으로 가이드 이름 대신 용어 — 목차와 똑같이 '용어 → 제목' 두 줄. ← 가 그 가이드 목차로 돌아간다.
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
            {section.keyword} · {n}/{total}
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
            {/* 11/22 ggue — 바로가기가 있는 곳은 누르면 그 서비스 화면이 새 창으로(이름은 링크 파랑 + ↗). 없는 곳은 글자만.
                덧말(다른 곳에서도 할 수 있음)은 작게 아래 줄. 줄은 가는 선으로 나눠 누르는 칸(48px)이 보이게 */}
            <ul className="flex flex-col divide-y divide-ink-100">
              {section.where.map((place) => {
                const text = (
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`text-[15px] leading-snug ${place.url ? "font-semibold text-brand-700" : "text-ink-700"}`}
                    >
                      {place.name}
                    </span>
                    {place.note && (
                      <>
                        <span className="sr-only">, </span>
                        <span className="text-[13px] leading-snug text-ink-500">{place.note}</span>
                      </>
                    )}
                  </span>
                );
                return (
                  <li key={place.name}>
                    {place.url ? (
                      <a
                        href={place.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="press-row focus-ring -mx-2 flex min-h-12 items-center gap-3 rounded-[10px] px-2 py-2.5"
                      >
                        {text}
                        <ExternalLink size={ICON_SM} aria-hidden="true" className="shrink-0 text-brand-600" />
                        <span className="sr-only">(새 창)</span>
                      </a>
                    ) : (
                      <div className="flex min-h-12 items-center py-2.5">{text}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {section.placesMap && (
          <Link href="/guides/places" className={buttonClass({ variant: "secondary", size: "md", full: true })}>
            <MapPin size={ICON_MD} aria-hidden="true" />
            가까운 주민센터 · 무인민원발급기 지도 보기
          </Link>
        )}

        {section.links?.map((link) => (
          <Link key={link.href} href={link.href} className={buttonClass({ variant: "secondary", size: "md", full: true })}>
            {link.label}
          </Link>
        ))}

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

        {/* 장 넘기기는 기록을 쌓지 않는다 — ← 가 늘 목차로 (./StepNav.tsx, 11/21 ggue) */}
        <StepNav base={base} n={n} total={total} />
        {/* 끝 장 = 이 가이드를 다 읽음 — '가이드 정독' 배지 재료(11/22, 이 기기에만) */}
        {n === total && <MarkGuideRead id={guide.id} />}
      </main>
    </AppShell>
  );
}
