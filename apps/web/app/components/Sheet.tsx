"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 아래에서 올라오는 확인 시트. 가입 제안·"처음부터 다시"·회원 탈퇴·충돌 질문이 함께 쓴다.
 *
 * 열려 있는 동안 Tab 은 시트 안에서만 돈다. Esc 와 어두운 바깥을 누르면 onClose.
 * 닫히면(이 컴포넌트가 사라지면) 시트를 연 요소로 포커스를 돌려준다 — 닫은 뒤 키보드 사용자가
 * 문서 맨 처음으로 튕기지 않게. 생김새는 신청 준비 화면의 외부 이동 안내와 같다.
 *
 * 부모가 열림 여부를 정한다: 열 때 그리고, 닫을 때 그리지 않는다.
 *
 * document.body 로 portal 한다. 여는 버튼이 sticky z-10 줄(답 요약 줄·StickyBottomAction) 안에 있어서,
 * 그 자리에 그리면 그 줄의 쌓임 맥락에 갇혀 상단바(z-20)가 어두운 바깥 위로 올라온다.
 * 열 때만 그리므로(클릭·동기화 상태 뒤) 서버 렌더링에서 document 를 만질 일이 없다.
 */
export function Sheet({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/45 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 min-[390px]:px-5 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="flex max-h-full w-full max-w-[350px] flex-col gap-4 overflow-y-auto rounded-card border border-ink-200 bg-surface p-6 shadow-card"
      >
        <h2 id={titleId} className="text-balance text-xl font-extrabold leading-snug text-ink-900">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-sm leading-relaxed text-ink-600">
            {description}
          </p>
        )}
        <div className="mt-1 flex flex-col gap-2">{children}</div>
      </section>
    </div>,
    document.body
  );
}
