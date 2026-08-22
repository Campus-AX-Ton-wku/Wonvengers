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
 * 히어로 그래픽 — 집으로 들어가는 지원금.
 *
 * 동전이 하나씩 떨어져 집 안에 쌓인다. 삼각형으로 쌓는 이유는 가로로 나란히 두면
 * 기계 조작부처럼 보이기 때문이다.
 */
const COINS = [
  { cx: 98, cy: 122, dy: "-92px", delay: 300 },
  { cx: 126, cy: 122, dy: "-104px", delay: 440 },
  { cx: 112, cy: 100, dy: "-84px", delay: 600 },
];

function HeroGraphic() {
  return (
    <svg viewBox="0 0 224 152" className="h-32 w-full" aria-hidden="true">
      <g className="draw-in">
        <rect
          x={58}
          y={82}
          width={108}
          height={62}
          rx={4}
          className="fill-brand-50 stroke-brand-600"
          strokeWidth={4}
        />
        <path d="M112 22 L184 84 L40 84 Z" className="fill-brand-600" strokeLinejoin="round" />
      </g>

      {COINS.map((c, i) => (
        <g
          key={`coin-${i}`}
          className="drop-in"
          style={{ "--dy": c.dy, animationDelay: `${c.delay}ms` } as React.CSSProperties}
        >
          <circle
            cx={c.cx}
            cy={c.cy}
            r={13}
            className="fill-brand-200 stroke-brand-600"
            strokeWidth={2.5}
          />
          <circle cx={c.cx} cy={c.cy} r={4.5} className="fill-brand-600" />
        </g>
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
