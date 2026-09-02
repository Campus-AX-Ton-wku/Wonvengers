import { AppShell, EmptyState, LinkButton } from "@/app/components";

/**
 * 결과 화면에 계산할 입력이 없을 때.
 *
 * 예전에는 조용히 홈으로 보냈다. 결과 화면은 링크로 공유되고 북마크되므로,
 * 튕기면 사용자는 자기가 뭘 잘못했는지 모른 채 랜딩에 서 있게 된다.
 * 왜 볼 수 없는지 말하고, 필요한 입력을 받는 곳으로 가는 길을 준다.
 *
 * 캐릭터는 thinking 이다 — 실패가 아니라 "아직 정보가 모자란다" 는 상태다.
 */
export default function MissingInput() {
  return (
    <AppShell className="justify-center">
      <EmptyState
        character="thinking"
        title="계산할 계약 조건이 없어요"
        description="최종 예상 주거비는 방의 보증금·월세·기간을 넣어야 계산할 수 있습니다. 입력값은 이 브라우저에만 저장되기 때문에, 다른 기기나 시크릿 창에서는 이어지지 않습니다."
        action={
          <>
            <LinkButton href="/calculate">계약 조건 입력하기</LinkButton>
            <LinkButton href="/find/policies" variant="quiet" size="md">
              지원금 목록 먼저 보기
            </LinkButton>
          </>
        }
      />
    </AppShell>
  );
}
