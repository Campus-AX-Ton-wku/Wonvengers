import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Icon3D, TopBar } from "@/app/components";
import { ChevronRight, ICON_MD } from "@/app/components/icons";
import { findGuide, GUIDES } from "@/lib/guides";
import { HOUSE_CHECKLIST_CARD } from "@/lib/house-checklist";
import { GuideCard } from "../GuideCard";
import { SourceList } from "../SourceList";

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

        {/* 계약 전 단계라 집 보러 갈 때 체크리스트로 이어 준다(11/22 ggue) — 다른 가이드에는 두지 않는다 */}
        {guide.id === "before-contract" && <GuideCard guide={HOUSE_CHECKLIST_CARD} />}

        <SourceList sources={guide.sources} />
      </main>
    </AppShell>
  );
}
