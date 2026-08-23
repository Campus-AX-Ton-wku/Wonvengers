import Link from "next/link";

/**
 * 결과 화면에 계산할 입력이 없을 때.
 *
 * 예전에는 조용히 홈으로 보냈다. 결과 화면은 링크로 공유되고 북마크되므로,
 * 튕기면 사용자는 자기가 뭘 잘못했는지 모른 채 랜딩에 서 있게 된다.
 * 왜 볼 수 없는지 말하고, 필요한 입력을 받는 곳으로 가는 길을 준다.
 */
export default function MissingInput() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10 text-center">
      <div>
        <p className="text-2xl font-extrabold text-ink-900">
          <span aria-hidden="true">🧮</span> 계산할 계약 조건이 없어요
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          최종 예상 주거비는 방의 보증금·월세·기간을 넣어야 계산할 수 있습니다.
          입력값은 이 브라우저에만 저장되기 때문에, 다른 기기나 시크릿 창에서는
          이어지지 않습니다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/calculate"
          className="rounded-xl bg-brand-600 py-4 text-base font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          계약 조건 입력하기
        </Link>
        <Link
          href="/find/policies"
          className="rounded-xl border border-ink-200 py-3 text-sm font-bold text-ink-600 transition-colors hover:border-ink-500 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          지원금 목록 먼저 보기
        </Link>
      </div>
    </main>
  );
}
