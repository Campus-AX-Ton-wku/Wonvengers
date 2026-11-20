import { AppShell, TopBar } from "@/app/components";
import { GUIDES } from "@/lib/guides";
import { GuideCard } from "./GuideCard";

/** 주거 가이드 전체 (홈 '주거 가이드 › 전체 보기'). 글은 lib/guides.ts. */
export default function GuidesPage() {
  return (
    <AppShell>
      <TopBar backHref="/home" />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">주거 가이드</h1>
        <p className="text-[15px] leading-relaxed text-ink-600">처음 집을 구할 때 놓치기 쉬운 것만 짧게 모았어요.</p>
        <ul className="flex flex-col gap-3">
          {GUIDES.map((guide) => (
            <li key={guide.id}>
              <GuideCard guide={guide} />
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
