import PerkyCharacter, { type PerkyState } from "./PerkyCharacter";

/**
 * 작게 놓는 Perky + 글 한두 줄 (디자인 시안 '마스코트 배치 가이드' — 작게 · 72–96px, 글 왼쪽).
 * 로딩·완료 안내처럼 화면의 주인공이 아닌 상태를 말할 때 쓴다. 화면 전체가 비었을 때는 EmptyState(가운데 세우기).
 *
 * 캐릭터는 aria-hidden 이다 — 상태는 언제나 옆 글자가 말한다. 64px 아래로는 줄이지 않는다(얼굴이 안 읽힌다).
 */
export function PerkyNote({
  state,
  title,
  description,
  role,
  className = "",
}: {
  state: PerkyState;
  title: string;
  description?: string;
  /** 로딩처럼 바뀌는 상태를 알릴 때 "status". 글 묶음에 붙는다. */
  role?: "status";
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PerkyCharacter state={state} size={80} priority className="h-auto w-20 shrink-0" />
      <div role={role} className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[15px] font-bold leading-snug text-ink-900">{title}</p>
        {description && <p className="text-[13px] leading-normal text-ink-600">{description}</p>}
      </div>
    </div>
  );
}
