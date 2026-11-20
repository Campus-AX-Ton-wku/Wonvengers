import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Icon3D, TopBar } from "@/app/components";
import { ChevronRight, ExternalLink, ICON_MD, ICON_SM } from "@/app/components/icons";
import { findGuide, GUIDES } from "@/lib/guides";

/** 정적 export — 가이드 수만큼 목차 페이지를 미리 만든다. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ id: g.id }));
}

/**
 * 가이드 목차 (11/20 ggue — 노션처럼 첫 페이지는 목차, 섹션은 한 장에 하나: ./[step]/page.tsx).
 * 끝에 출처와 확인한 날을 단다 — 제도는 바뀌니까 공식 안내로 다시 확인하라고 같이 말한다.
 */
export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guide = findGuide(id);
  if (!guide) notFound();
  return (
    <AppShell>
      <TopBar backHref="/guides" />
      <main className="flex flex-col gap-6 pb-10 pt-2.5">
        <header className="flex items-center gap-3.5">
          <Icon3D name={guide.icon} size={64} />
          {/* '5장 · 약 3분' 줄은 11/20 뺐다(ggue) — 목차가 바로 아래 있어 몇 장인지 보인다 */}
          <h1 className="min-w-0 text-2xl font-extrabold leading-snug text-ink-900">{guide.title}</h1>
        </header>

        <nav aria-label="목차">
          <ol className="flex flex-col overflow-hidden rounded-card bg-surface shadow-card">
            {guide.sections.map((section, i) => (
              <li key={section.title} className="border-b border-ink-100 last:border-b-0">
                <Link
                  href={`/guides/${guide.id}/${i + 1}`}
                  className="focus-ring flex min-h-14 items-center gap-3.5 px-4 py-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand-700"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-ink-900">{section.title}</span>
                  <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {/* 출처 — 기관 이름(굵게) · 본 내용(작게) 두 줄, 칸으로 나눈 목록 (11/20 ggue: 줄표 · 띄운 가운뎃점이 섞인 긴 링크가 어색했다).
            '~에 확인했어요' 문단은 뺐다 — 확인일은 lib/guides.ts 의 checkedAt 에 남아 있다 */}
        <section aria-labelledby="guide-sources" className="flex flex-col gap-2">
          <h2 id="guide-sources" className="text-[15px] font-bold text-ink-700">
            출처
          </h2>
          <ul className="flex flex-col overflow-hidden rounded-card border border-ink-200 bg-surface">
            {guide.sources.map((source) => (
              <li key={source.url + (source.topic ?? "")} className="border-b border-ink-100 last:border-b-0">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring flex min-h-12 items-center gap-3 px-4 py-2.5"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold leading-snug text-ink-900">{source.name}</span>
                    {source.topic && (
                      <>
                        <span className="sr-only">, </span>
                        <span className="text-xs leading-snug text-ink-500">{source.topic}</span>
                      </>
                    )}
                  </span>
                  <ExternalLink size={ICON_SM} aria-hidden="true" className="shrink-0 text-ink-500" />
                  <span className="sr-only">(새 창)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
