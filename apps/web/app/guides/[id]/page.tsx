import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Icon3D, TopBar } from "@/app/components";
import { ChevronDown, ChevronRight, ExternalLink, ICON_MD, ICON_SM } from "@/app/components/icons";
import { findGuide, GUIDES } from "@/lib/guides";

/** 정적 export — 가이드 수만큼 목차 페이지를 미리 만든다. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ id: g.id }));
}

/**
 * 가이드 목차 (11/20 ggue — 노션처럼 첫 페이지는 목차, 섹션은 한 장에 하나: ./[step]/page.tsx).
 *
 * 11/21 ggue 시안 '내용은 크게, 출처는 한 줄로' — 책으로 치면 목차는 본문, 출처는 맨 뒤 참고문헌.
 * 목차 한 줄은 용어(작게, 파랑) + 제목(크게) 두 줄로 키워 화면에서 가장 무거운 덩어리로 두고,
 * 출처는 가는 선 아래 '출처 n곳' 한 줄로 접어 둔다. 지우는 게 아니라 접는 것 — 펼치면 다 있다.
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
              <li key={section.keyword} className="border-b border-ink-100 last:border-b-0">
                <Link
                  href={`/guides/${guide.id}/${i + 1}`}
                  className="focus-ring flex min-h-19 items-center gap-3.5 py-3.5 pl-4 pr-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[15px] font-extrabold text-brand-700"
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-xs font-bold leading-[1.3] text-brand-700">{section.keyword}</span>
                    {/* text-balance — 좁은 화면에서 '받아 / 둬요'처럼 한 낱말만 다음 줄로 떨어지지 않게 */}
                    <span className="text-balance text-base font-bold leading-[1.45] text-ink-900">{section.title}</span>
                  </span>
                  <ChevronRight size={ICON_MD} aria-hidden="true" className="shrink-0 text-ink-300" />
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {/* 출처 — 처음엔 접힌 한 줄. 결과 화면 접기(Disclosure)처럼 네이티브 <details> 라 스크립트 없이 첫 페인트부터 접혀 있고
            키보드로 연다. 다만 Disclosure 의 회색 막대는 출처를 다시 무겁게 만들어서, 겉은 시안대로 회색 글씨 한 줄이다.
            펼친 줄은 '기관 · 본 내용' — 시안은 한 줄에서 '…'로 잘랐지만 320px 에서는 잘리는 줄이 있어 자르지 않고 두 줄로 넘긴다.
            '~에 확인했어요' 문단은 11/20 뺐다 — 확인일은 lib/guides.ts 의 checkedAt 에 남아 있다 */}
        <section aria-label="출처" className="border-t border-ink-200 pt-1">
          <details className="group">
            <summary className="focus-ring -ml-1.5 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-[10px] px-1.5 text-[13px] font-semibold text-ink-500 [&::-webkit-details-marker]:hidden">
              출처 {guide.sources.length}곳
              <ChevronDown
                size={ICON_SM}
                aria-hidden="true"
                className="shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul>
              {guide.sources.map((source) => (
                <li key={source.url + (source.topic ?? "")}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring flex min-h-11 items-center gap-2 border-b border-ink-100 py-2.5"
                  >
                    <span className="min-w-0 flex-1 text-[13px] leading-[1.4] text-ink-600">
                      <span className="font-semibold text-ink-700">{source.name}</span>
                      {source.topic && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="sr-only">, </span>
                          <span>{source.topic}</span>
                        </>
                      )}
                    </span>
                    <ExternalLink size={14} aria-hidden="true" className="shrink-0 text-ink-300" />
                    <span className="sr-only">(새 창)</span>
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </main>
    </AppShell>
  );
}
