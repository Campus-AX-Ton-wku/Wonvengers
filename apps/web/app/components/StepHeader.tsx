"use client";

/**
 * 질문 그 자체가 화면 제목이다. 번호도 이모지도 붙이지 않는다.
 *
 * 줄바꿈은 text-balance 에 맡긴다. 화면별로 \n 을 박아 두면 폭이 충분한 기기에서도
 * 오른쪽이 빈다. 한글은 body 의 word-break: keep-all 이 어절을 지켜 준다.
 *
 * leading-tight(1.25)은 26px 한글에서 윗선이 잘린다. 한글은 라틴보다 글자틀이 크고
 * 받침이 아래로 내려가므로 1.35 는 있어야 두 줄이 안 붙는다.
 */
export function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-balance text-[26px] font-extrabold leading-[1.35] tracking-tight text-ink-900">
        {title}
      </h1>
      {description && <p className="text-sm leading-relaxed text-ink-600">{description}</p>}
    </div>
  );
}
