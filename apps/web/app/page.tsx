import Link from "next/link";
import policiesJson from "@/data/policies.json";

/*
 * 정책 개수는 데이터에서 센다. 하드코딩하면 정책이 늘거나 줄 때 랜딩이 거짓말을 한다.
 * 이 페이지는 서버 컴포넌트라 JSON 자체는 번들에 실리지 않고 숫자만 렌더된다.
 */
const POLICY_COUNT = policiesJson.length;

/*
 * 금액을 헤드라인으로 올릴 자리.
 *
 * 지금은 null 이다. 금액을 걸려면 두 조건을 함께 만족하는 정책이 있어야 하는데,
 * 아직 없다 (2026-08-25 기준).
 *
 *   1. 공고 원문과 대조가 끝났다 — verifiedAt 이 있다
 *   2. 지금 신청할 수 있다 — 접수 기간 안이다
 *
 * 금액이 큰 정책은 이미 마감이다. 청년월세 지원 480만원은 2026-05-29 마감,
 * 전북청년 지역정착 360만원은 2026-04-10 마감. 지금 접수 중인 것 중 가장 큰
 * 익산형 청년월세 240만원은 하필 다섯 건 중 유일하게 대조 전이다. 남은 상시 접수
 * 정책은 이사비·중개보수 50만원(일시금)과 주거급여 분리지급 월 21만 2,000원이다.
 *
 * 마감된 정책의 금액을 내걸면 사용자는 신청할 수 없다는 걸 뒤늦게 안다. 대조 전
 * 금액을 내걸면 틀린 확신이 된다. 둘 다 이 서비스의 가장 큰 약속으로 쓸 수 없다.
 *
 * 두 조건을 만족하는 정책이 생기면 여기에 최대 지원액(원)과 기준일을 채운다.
 * 그러면 헤드라인이 개수판에서 금액판으로 바뀐다. 구조는 그대로다.
 */
const MAX_BENEFIT: { won: number; asOf: string } | null = null;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      {/* 브랜드는 출발점을 알려주는 작은 표식이다. 이 화면에서 가장 먼저 읽혀야 할
          것은 이름이 아니라 사용자가 얻는 결과다. */}
      <p
        className="rise-in text-2xl font-extrabold tracking-tight text-ink-900"
        style={{ animationDelay: "0ms" }}
      >
        Perky
      </p>

      <div className="flex flex-1 flex-col justify-center pb-12">
        {/* 헤드라인이 사실을 나른다 — 지역과 개수가 제목 자리를 갖는다. */}
        <h1
          className="rise-in break-keep text-4xl font-extrabold leading-[1.24] tracking-tight text-ink-900"
          style={{ animationDelay: "230ms" }}
        >
          {MAX_BENEFIT ? (
            <>
              익산 청년이 받을 수 있는
              <br />
              최대 {(MAX_BENEFIT.won / 10000).toLocaleString("ko-KR")}만원
            </>
          ) : (
            <>
              익산 청년이 받을 수 있는
              <br />
              주거 지원금 {POLICY_COUNT}개
            </>
          )}
        </h1>

        <p
          className="rise-in mt-5 break-keep text-base leading-relaxed text-ink-600"
          style={{ animationDelay: "300ms" }}
        >
          국가·전북·익산에 흩어진 정책을 한 화면에 모아
          <br />
          내가 받을 수 있는 것만 골라 보여드립니다.
        </p>
      </div>

      <div className="rise-in" style={{ animationDelay: "370ms" }}>
        <Link
          href="/find"
          className="block rounded-2xl bg-brand-600 px-6 py-4 text-center text-lg font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:bg-brand-700"
        >
          내 지원금 찾아보기
        </Link>
      </div>
    </main>
  );
}
