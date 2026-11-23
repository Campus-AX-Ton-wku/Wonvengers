import { ChevronDown, ExternalLink, ICON_SM } from "@/app/components/icons";
import type { GuideSource } from "@/lib/guides";

/**
 * 출처 — 가이드 목차와 집 보러 갈 때 체크리스트(11/22)가 같이 쓴다.
 * 처음엔 접힌 한 줄. 결과 화면 접기(Disclosure)처럼 네이티브 <details> 라 스크립트 없이 첫 페인트부터 접혀 있고
 * 키보드로 연다. 다만 Disclosure 의 회색 막대는 출처를 다시 무겁게 만들어서, 겉은 시안대로 회색 글씨 한 줄이다.
 * 펼친 줄은 '기관 · 본 내용' — 시안은 한 줄에서 '…'로 잘랐지만 320px 에서는 잘리는 줄이 있어 자르지 않고 두 줄로 넘긴다.
 * '~에 확인했어요' 문단은 11/20 뺐다 — 확인일은 lib/guides.ts 의 checkedAt 에 남아 있다
 */
export function SourceList({ sources }: { sources: GuideSource[] }) {
  return (
    <section aria-label="출처" className="border-t border-ink-200 pt-1">
      <details className="group">
        <summary className="focus-ring -ml-1.5 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-[10px] px-1.5 text-[13px] font-semibold text-ink-500 [&::-webkit-details-marker]:hidden">
          출처 {sources.length}곳
          <ChevronDown
            size={ICON_SM}
            aria-hidden="true"
            className="shrink-0 transition-transform group-open:rotate-180"
          />
        </summary>
        <ul>
          {sources.map((source) => (
            <li key={source.url + (source.topic ?? "")}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="press-row focus-ring flex min-h-11 items-center gap-2 border-b border-ink-100 py-2.5"
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
  );
}
