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
 * 지금은 null 이다. policies.json 의 정책 5개가 전부 verifiedAt: null — 공식 공고
 * 교차검수 전이라, 미검증 금액을 이 서비스의 가장 큰 약속으로 내걸 수 없다.
 *
 * 교차검수가 끝나면 여기에 최대 지원액(원)과 기준일을 채운다. 그러면 헤드라인이
 * 개수판에서 금액판으로 바뀐다. 구조는 그대로다.
 */
const MAX_BENEFIT: { won: number; asOf: string } | null = null;

/*
 * 히어로 그래픽 — 원룸 건물, 창 하나에 불이 들어온다.
 *
 * 박공지붕 단독주택을 쓰지 않는 이유: 익산 청년의 월세는 원룸·오피스텔·빌라다.
 * 단독주택은 이 사용자가 살지 않는 집이다.
 *
 * 서사는 "켜진 창" 하나가 나른다 — 흩어진 지원금 중 내 것 하나가 찾아졌다는 뜻이다.
 * 떨어지는 동전을 쓰지 않는 이유: 정지 상태(prefers-reduced-motion)에서 경로가
 * 읽히지 않아 의미가 사라진다. 창은 켜진 채로 멈춰 있어도 그대로 읽힌다.
 *
 * 선 굵기는 4 하나로 통일한다. 이전 버전은 채움·선 4·선 2.5 세 어법이 섞여 있었다.
 */
const WINDOWS = [
  { x: 70, y: 58, accent: false, delay: 220 },
  { x: 102, y: 58, accent: true, delay: 520 },
  { x: 134, y: 58, accent: false, delay: 300 },
  { x: 70, y: 88, accent: false, delay: 380 },
  { x: 102, y: 88, accent: false, delay: 260 },
  { x: 134, y: 88, accent: false, delay: 340 },
];

function HeroGraphic() {
  return (
    <svg viewBox="0 0 224 152" className="h-32 w-full" aria-hidden="true">
      <g className="draw-in">
        {/* 옥상 슬래브 — 평지붕이라 건물 폭보다 살짝 넓게만 낸다 */}
        <rect x={54} y={32} width={116} height={11} rx={3} className="fill-brand-600" />
        {/* 몸통 */}
        <rect
          x={64}
          y={43}
          width={96}
          height={101}
          rx={4}
          className="fill-white stroke-brand-600"
          strokeWidth={4}
        />
        {/* 현관 */}
        <rect x={104} y={118} width={16} height={26} rx={2} className="fill-brand-600" />
      </g>

      {WINDOWS.map((w, i) => (
        <rect
          key={`win-${i}`}
          x={w.x}
          y={w.y}
          width={20}
          height={18}
          rx={2}
          className={`pop-in ${w.accent ? "fill-accent-600" : "fill-brand-200"}`}
          style={{ animationDelay: `${w.delay}ms` } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-12">
      <div className="rise-in">
        <HeroGraphic />
      </div>

      <div>
        <p
          className="rise-in text-xs font-bold uppercase tracking-[0.22em] text-ink-500"
          style={{ animationDelay: "80ms" }}
        >
          Perky
        </p>

        {/* 헤드라인이 사실을 나른다 — 지역과 개수를 브랜드명보다 먼저 보여준다. */}
        <h1
          className="rise-in mt-3 text-4xl font-extrabold leading-[1.25] tracking-tight text-ink-900"
          style={{ animationDelay: "160ms" }}
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
          className="rise-in mt-5 text-base leading-relaxed text-ink-600"
          style={{ animationDelay: "240ms" }}
        >
          국가·전북·익산에 흩어진 정책을 한 화면에 모아
          <br />
          내가 받을 수 있는 것만 골라 보여드립니다.
        </p>
      </div>

      <div className="rise-in" style={{ animationDelay: "300ms" }}>
        <Link
          href="/find"
          className="block rounded-xl bg-brand-600 px-6 py-4 text-center text-lg font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:bg-brand-700"
        >
          내 지원금 찾아보기
        </Link>
        <p className="mt-3 text-center text-sm text-ink-500">질문 4개 · 약 1분</p>
      </div>

      {/* 신뢰 스트립 — 다음 화면에서 나이·소득을 묻기 전에 답해야 하는 세 가지.
          내용은 전부 사실이다: 서버가 없고 답변은 localStorage 에만 남는다. */}
      <div
        className="rise-in border-t border-ink-100 pt-5 text-center text-xs leading-relaxed text-ink-500"
        style={{ animationDelay: "360ms" }}
      >
        <p>회원가입 없이 · 입력값은 이 브라우저에만 저장됩니다</p>
        <p className="mt-1">
          국토교통부 · 전북특별자치도 · 익산시 공고 기준
          {MAX_BENEFIT ? ` · ${MAX_BENEFIT.asOf} 기준` : ""}
        </p>
        <p className="mt-1">자격은 각 기관이 심사해 결정합니다</p>
      </div>
    </main>
  );
}
