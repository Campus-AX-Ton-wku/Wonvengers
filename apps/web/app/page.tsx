import Link from "next/link";
import policiesJson from "@/data/policies.json";
import { AppShell, LinkButton, PerkyCharacter, Wordmark } from "@/app/components";

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

/**
 * 랜딩.
 *
 * 첫 방문자는 이 화면을 보기 전에 온보딩 3장을 본다 (app/layout.tsx 의 인라인
 * 스크립트). 그래서 여기는 소개가 아니라 출발점이다 — 사실 한 줄과 버튼 하나.
 *
 * 캐릭터는 wave 다. 이 화면의 상태는 "인사" 하나뿐이고, 한 화면에 한 포즈만 쓴다.
 * 위에서 아래로 캐릭터 → 브랜드 → 사실 → 설명 → 버튼 한 축으로 읽힌다.
 */
export default function Home() {
  return (
    <AppShell className="justify-center">
      <main className="flex flex-col items-center gap-7 py-10 text-center">
        <PerkyCharacter
          state="wave"
          size={480}
          priority
          className="rise-in h-auto w-[min(46vw,176px)]"
        />

        {/* 워드마크가 크지만 <h1> 은 아니다. 문서 개요에서 제목 자리는 사실이 갖는다. */}
        <div className="rise-in" style={{ animationDelay: "80ms" }}>
          <Wordmark size="lg" />
        </div>

        <div className="flex flex-col gap-3">
          {/* 헤드라인이 사실을 나른다 — 지역과 개수가 제목 자리를 갖는다. */}
          <h1
            className="rise-in text-[28px] font-extrabold leading-[1.35] tracking-tight text-ink-900"
            style={{ animationDelay: "170ms" }}
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
                주거 지원금 <span className="text-brand-600">{POLICY_COUNT}개</span>
              </>
            )}
          </h1>

          <p
            className="rise-in text-[15px] leading-relaxed text-ink-600"
            style={{ animationDelay: "240ms" }}
          >
            국가·전북·익산에 흩어진 정책을 한 화면에 모아
            <br />
            내가 받을 수 있는 것만 골라 보여드립니다.
          </p>
        </div>

        <div
          className="rise-in flex w-full flex-col items-center gap-1"
          style={{ animationDelay: "310ms" }}
        >
          <LinkButton href="/find">내 지원금 찾아보기</LinkButton>

          {/* 온보딩을 다시 보는 길. 자동 노출은 첫 방문에 한 번뿐이라, 이 링크가
              없으면 한 번 건너뛴 사람과 QA 는 저장소를 지우는 수밖에 없다. */}
          <Link
            href="/onboarding"
            className="focus-ring flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink-500 transition-colors hover:text-brand-700"
          >
            앱 소개 다시 보기
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
