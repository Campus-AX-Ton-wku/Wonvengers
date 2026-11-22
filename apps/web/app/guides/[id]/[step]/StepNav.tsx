"use client";

import { useRouter } from "next/navigation";
import { LinkButton } from "@/app/components";
import { ChevronLeft, ChevronRight, ICON_MD } from "@/app/components/icons";
import { replaceKeepingEntry, useBack } from "@/lib/navigation";

/** ⌘ · Ctrl · Shift · Alt · 가운데 버튼 클릭은 새 탭 · 새 창으로 여는 것이라 브라우저에 맡긴다. */
function isPlainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * 가이드 한 장 아래 이전 · 다음 (11/21 ggue — 장에서 ← 를 누르면 그 가이드 목차로).
 *
 * 왼쪽 위 ← 는 휴대폰 뒤로가기와 같아서(lib/navigation.ts useBack) 기록을 한 칸 되짚는다. 예전엔 장 넘기기가
 * 기록을 쌓아 ← 가 직전 장으로 갔다. 그래서 장 넘기기는 책장 넘기듯 지금 칸을 바꿔 끼운다(replace) — 기록은
 * '목차 → 지금 장' 두 칸뿐이고, ← 도 휴대폰 뒤로가기도 몇 장을 넘겼든 목차로 간다.
 * 주소로 장을 바로 열었으면(이 탭 첫 화면) replaceKeepingEntry 가 첫 화면 표를 옮겨, ← 가 앱 밖이 아니라 목차로 간다.
 *
 * [목차로](마지막 장)는 ← 와 똑같다. 새로 이동하면 '목차 → 장 → 목차'가 쌓여 목차의 ← 가 다시 장으로 온다.
 * 주소(href)는 그대로 둬서 링크로 읽히고, 새 탭으로 열기도 된다.
 */
export function StepNav({ base, n, total }: { base: string; n: number; total: number }) {
  const router = useRouter();
  const back = useBack(base);

  const turnTo = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    replaceKeepingEntry(router, href);
  };
  const toToc = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    back();
  };

  return (
    <nav aria-label="장 이동" className="mt-auto flex gap-2 pt-4">
      {n > 1 && (
        <LinkButton href={`${base}/${n - 1}`} onClick={turnTo(`${base}/${n - 1}`)} variant="secondary" size="md" className="flex-1">
          <ChevronLeft size={ICON_MD} aria-hidden="true" />
          이전
        </LinkButton>
      )}
      {n < total ? (
        <LinkButton href={`${base}/${n + 1}`} onClick={turnTo(`${base}/${n + 1}`)} size="md" className="flex-1">
          다음
          <ChevronRight size={ICON_MD} aria-hidden="true" />
        </LinkButton>
      ) : (
        <LinkButton href={base} onClick={toToc} size="md" className="flex-1">
          목차로
        </LinkButton>
      )}
    </nav>
  );
}
