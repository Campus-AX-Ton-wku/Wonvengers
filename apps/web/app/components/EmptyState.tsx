import PerkyCharacter, { type PerkyState } from "./PerkyCharacter";

/**
 * 아무것도 없을 때의 화면.
 *
 * 캐릭터는 여기처럼 "상태를 말해야 하는 자리" 에만 쓴다. 한 화면에 한 포즈다 —
 * 포즈가 둘 이상이면 어느 것이 지금 상태인지 알 수 없다.
 *
 * 빈 상태는 왜 비었는지와 다음에 무엇을 할 수 있는지를 함께 말한다. 둘 중 하나만
 * 있으면 사용자는 자기가 뭘 잘못했는지 모른 채 서 있게 된다.
 */
export function EmptyState({
  character = "empty",
  title,
  description,
  action,
}: {
  character?: PerkyState;
  title: string;
  description?: React.ReactNode;
  /** 다음 행동. 버튼 하나 또는 둘. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <PerkyCharacter state={character} size={200} className="h-auto w-[min(48vw,180px)]" />
      <div className="flex flex-col gap-2">
        <p className="text-xl font-extrabold leading-snug text-ink-900">{title}</p>
        {description && (
          <p className="text-sm leading-relaxed text-ink-600">{description}</p>
        )}
      </div>
      {action && <div className="flex w-full flex-col gap-2">{action}</div>}
    </div>
  );
}
