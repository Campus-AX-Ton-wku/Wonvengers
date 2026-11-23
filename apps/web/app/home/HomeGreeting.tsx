import Link from "next/link";
import { ProfileAvatar } from "@/app/components";
import { profileName } from "@/lib/profile-card";
import type { DiscoveryAnswers } from "@/lib/types";
import type { ProfileCardData } from "@/lib/user-data";

/**
 * 홈 인사 (내 프로필 설계 §5, 시안 Main · HomePlus) — 제목 위에 작은 그림 + "익산 사는 대학생님, 반가워요".
 * 이름을 안 정했으면 내 조건으로 지은 기본 이름. 누르면 내 정보. 계산 전 · 후 홈이 같은 머리를 쓴다.
 */
export function HomeGreeting({ card, answers }: { card: ProfileCardData | null; answers: DiscoveryAnswers }) {
  const { name } = profileName(card, answers);
  return (
    <Link
      href="/account"
      aria-label={`${name}님, 반가워요 — 내 정보로`}
      className="focus-ring -mb-1.5 -ml-0.5 flex min-h-11 items-center gap-2.5 self-start rounded-full pr-2"
    >
      <ProfileAvatar card={card} size="sm" />
      <span className="text-[15px] font-semibold leading-snug text-ink-700">
        <b className="font-extrabold text-ink-900">{name}</b>님, 반가워요
      </span>
    </Link>
  );
}
