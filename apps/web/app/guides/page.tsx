import { AppShell, TopBar } from "@/app/components";
import { GUIDES } from "@/lib/guides";
import { HOUSE_CHECKLIST_CARD } from "@/lib/house-checklist";
import { GuideCard } from "./GuideCard";

/** 주거 가이드 전체 (홈 '주거 가이드 › 전체 보기'). 글은 lib/guides.ts. */
export default function GuidesPage() {
  return (
    <AppShell>
      <TopBar backHref="/home" />
      <main className="flex flex-col gap-4 pb-10 pt-2.5">
        <h1 className="text-2xl font-extrabold leading-snug text-ink-900">주거 가이드</h1>
        <ul className="flex flex-col gap-3">
          {/* 집 보러 갈 때 체크리스트(11/22) — 계약 전에 가장 먼저 쓰는 것이라 맨 위 */}
          <li>
            <GuideCard guide={HOUSE_CHECKLIST_CARD} />
          </li>
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
