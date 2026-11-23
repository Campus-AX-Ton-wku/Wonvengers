import { AppShell, Icon3D, TopBar } from "@/app/components";
import { SourceList } from "@/app/guides/SourceList";
import { HOUSE_CHECKLIST_CARD, HOUSE_CHECKLIST_SOURCES } from "@/lib/house-checklist";
import { HouseChecklist } from "./HouseChecklist";

/**
 * 집 보러 갈 때 체크리스트 (docs/기획/2026-11-22-집-보기-체크리스트-설계.md, ggue 11/22).
 * 판정하지 않는다 — 확인한 것만 이 기기에 남긴다. ← 는 가이드 목록.
 * 고정 경로라 /guides/[id] 보다 먼저 잡힌다.
 */
export default function ChecklistPage() {
  return (
    <AppShell>
      <TopBar backHref="/guides" />
      <main className="flex flex-col gap-6 pb-10 pt-2.5">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3.5">
            <Icon3D name={HOUSE_CHECKLIST_CARD.icon} size={64} />
            <h1 className="min-w-0 text-2xl font-extrabold leading-snug text-ink-900">{HOUSE_CHECKLIST_CARD.title}</h1>
          </div>
          <p className="text-[15px] leading-relaxed text-ink-600">집을 보면서 하나씩 눌러 확인해요. 확인한 것은 로그인하면 계정에 저장돼요.</p>
        </header>
        <HouseChecklist />
        <SourceList sources={HOUSE_CHECKLIST_SOURCES} />
      </main>
    </AppShell>
  );
}
