import { notFound } from "next/navigation";
import { AppShell, Icon3D, TopBar } from "@/app/components";
import { ExternalLink, ICON_SM } from "@/app/components/icons";
import { formatDotDate } from "@/lib/date";
import { findGuide, GUIDES } from "@/lib/guides";

/** 정적 export — 가이드 수만큼 페이지를 미리 만든다. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ id: g.id }));
}

/**
 * 가이드 한 편. 끝에 출처와 확인한 날을 단다 — 제도는 바뀌니까 공식 안내로 다시 확인하라고 같이 말한다.
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
          <Icon3D name={guide.icon} size={48} />
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">{guide.title}</h1>
        </header>
        {guide.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-bold leading-snug text-ink-900">{section.heading}</h2>
            <ul className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-700">
                  <span aria-hidden="true" className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-brand-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section aria-labelledby="guide-sources" className="flex flex-col gap-2">
          <h2 id="guide-sources" className="text-[15px] font-bold text-ink-700">
            출처
          </h2>
          <ul className="flex flex-col gap-1">
            {guide.sources.map((source) => (
              <li key={source.url + source.label}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
                >
                  {source.label}
                  <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
                  <span className="sr-only">(새 창)</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-relaxed text-ink-500">
            {formatDotDate(guide.checkedAt)}에 확인했어요. 제도와 절차는 바뀔 수 있으니 계약하거나 신청하기 전에 위 공식 안내를 다시 확인해 주세요.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
