"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ChecklistRow } from "@/app/components";
import { ChevronRight, ICON_SM } from "@/app/components/icons";
import { HOUSE_CHECKLIST_GROUPS, HOUSE_CHECKLIST_ITEM_IDS } from "@/lib/house-checklist";
import { HOUSE_CHECKLIST_KEY, clearHouseChecklist, loadHouseChecklist, saveHouseChecklist } from "@/lib/storage";

/**
 * 체크 줄 · 진행 · 지우기. 정적 export 라 처음엔 0 으로 그리고, 저장된 체크는 그린 뒤 읽는다.
 * 다른 탭에서 바꾸면 storage 이벤트로 다시 읽는다(주거비 달력과 같음).
 * 비우기 버튼 이름은 [체크 모두 지우기] — 앱 전체 '처음부터 다시'(답 비우기)와 헷갈리지 않게.
 */
export function HouseChecklist() {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const read = () => setChecked(new Set(loadHouseChecklist()));
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === HOUSE_CHECKLIST_KEY || event.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const total = HOUSE_CHECKLIST_ITEM_IDS.length;
  const done = HOUSE_CHECKLIST_ITEM_IDS.filter((id) => checked.has(id)).length;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    setChecked(next);
    saveHouseChecklist(HOUSE_CHECKLIST_ITEM_IDS.filter((x) => next.has(x)));
  };
  const clearAll = () => {
    setChecked(new Set());
    clearHouseChecklist();
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <p aria-live="polite" className="text-sm font-bold text-ink-700">
          {done}/{total} 확인
        </p>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      {HOUSE_CHECKLIST_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`checklist-${group.id}`} className="flex flex-col gap-2.5">
          <h2 id={`checklist-${group.id}`} className="text-lg font-extrabold leading-snug text-ink-900">
            {group.title}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <ChecklistRow
                  checked={checked.has(item.id)}
                  label={item.label}
                  support={<span className="mt-0.5 block text-[13px] leading-snug text-ink-500">{item.how}</span>}
                  onChange={(on) => toggle(item.id, on)}
                />
              </li>
            ))}
          </ul>
          {group.more && (
            <Link
              href={group.more.href}
              className="focus-ring -ml-1.5 inline-flex min-h-11 w-fit items-center gap-0.5 rounded-[10px] px-1.5 text-sm font-semibold text-brand-700"
            >
              {group.more.label}
              <ChevronRight size={ICON_SM} aria-hidden="true" />
            </Link>
          )}
        </section>
      ))}

      {done > 0 && (
        <Button variant="secondary" size="md" onClick={clearAll}>
          체크 모두 지우기
        </Button>
      )}
    </div>
  );
}
