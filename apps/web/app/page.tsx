import Link from "next/link";

/*
 * 히어로 그래픽 — 집으로 들어가는 지원금.
 *
 * 동전이 하나씩 떨어져 집 안으로 들어간다. 텍스트 없이도 "주거 + 돈"이
 * 바로 읽히도록 형태를 단순하게 유지한다.
 *
 * dy 는 동전이 떨어지기 시작하는 높이(최종 위치 기준 상대값)다.
 * globals.css 의 drop-in 키프레임이 이 값을 읽는다.
 */
/* 삼각형으로 쌓아 동전 더미로 읽히게 한다. 가로로 나란히 두면 기계 조작부처럼 보인다.
   위에 얹히는 동전을 가장 늦게 떨어뜨려 쌓이는 순서가 자연스럽게 보이도록 한다. */
const COINS = [
  { cx: 98, cy: 122, dy: "-92px", delay: 300 },
  { cx: 126, cy: 122, dy: "-104px", delay: 440 },
  { cx: 112, cy: 100, dy: "-84px", delay: 600 },
];

function HeroGraphic() {
  return (
    <svg
      viewBox="0 0 224 152"
      className="h-36 w-full"
      role="presentation"
      aria-hidden="true"
    >
      {/* 집 — 몸통을 먼저 깔고 지붕을 얹는다 */}
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
        <path
          d="M112 22 L184 84 L40 84 Z"
          className="fill-brand-600"
          strokeLinejoin="round"
        />
      </g>

      {/* 동전 — 집 뒤에 그려 몸통 안에 쌓인 것처럼 보이게 한다 */}
      {COINS.map((c, i) => (
        <g
          key={`coin-${i}`}
          className="drop-in"
          style={
            { "--dy": c.dy, animationDelay: `${c.delay}ms` } as React.CSSProperties
          }
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
        <h1
          className="rise-in text-6xl font-extrabold tracking-tight text-ink-900"
          style={{ animationDelay: "80ms" }}
        >
          Perky
        </h1>

        <p
          className="rise-in mt-5 text-2xl font-bold leading-snug text-ink-900"
          style={{ animationDelay: "160ms" }}
        >
          받을 수 있는
          <br />
          주거 지원금부터 확인하세요
        </p>

        <p
          className="rise-in mt-4 text-base leading-relaxed text-ink-600"
          style={{ animationDelay: "240ms" }}
        >
          흩어져 있는 청년 주거 지원금,
          <br />
          내가 받을 수 있는 것만 골라 보여드립니다.
        </p>
      </div>

      <div className="rise-in" style={{ animationDelay: "320ms" }}>
        <Link
          href="/find"
          className="block rounded-xl bg-brand-600 px-6 py-4 text-center text-lg font-bold text-white active:bg-brand-700"
        >
          내 지원금 찾아보기
        </Link>
        <p className="mt-3 text-center text-sm text-ink-500">질문 4개 · 약 1분</p>
      </div>
    </main>
  );
}
