import type { ContactInfo as Contact } from "@/lib/types";
import { ExternalLink, ICON_SM, Phone } from "./icons";

export const telHref = (phone: string) => `tel:${phone.replaceAll("-", "")}`;

/**
 * 담당 연락처. 정책 상세·신청 준비·결과 카드가 같은 모양으로 쓴다.
 *
 * null 이면 그리지 않는다 — "문의: 확인 필요" 같은 빈 칸은 신뢰를 깎는다.
 * 확인 못 한 항목은 화면에서 조용히 빠지고, 출처 링크가 그 자리를 대신한다.
 */
export function ContactInfo({ contact, variant }: { contact: Contact | null; variant: "block" | "inline" }) {
  if (!contact) return null;
  const phoneLink = contact.phone && (
    <a
      href={telHref(contact.phone)}
      aria-label={`문의 전화 ${contact.phone}`}
      className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-control font-bold text-brand-700 underline hover:text-brand-800"
    >
      <Phone size={ICON_SM - 2} aria-hidden="true" />
      {contact.phone}
    </a>
  );

  if (variant === "inline") {
    return (
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-600">
        <span>문의 · {contact.department}</span>
        {phoneLink}
      </p>
    );
  }

  return (
    <section aria-label="문의" className="rounded-control bg-surface px-4 py-3.5 shadow-card">
      <h2 className="text-sm font-bold leading-[22px] text-ink-900">문의</h2>
      <p className="mt-1 text-xs text-ink-600">{contact.department}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 text-sm">
        {phoneLink}
        {contact.url && (
          <a
            href={contact.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-control text-ink-600 underline hover:text-ink-900"
          >
            문의 페이지
            <ExternalLink size={ICON_SM - 2} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
