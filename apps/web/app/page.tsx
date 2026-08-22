import Link from "next/link";

/*
 * 히어로 그래픽 — "흩어진 지원금을 한 목록으로".
 *
 * 흩어져 있던 조각들이 제자리로 모여 하나의 목록이 되는 장면이다. 집·동전 같은
 * 장식적 클리셰 대신 제품이 하는 일을 그대로 그린다.
 *
 * dx/dy 는 각 조각이 날아오기 시작하는 위치(최종 위치 기준 상대값)다.
 * globals.css 의 gather 키프레임이 이 값을 읽는다.
 */
const ROWS = [
  { y: 8, w: 148, dx: "-52px", dy: "-30px", delay: 0 },
  { y: 40, w: 176, dx: "56px", dy: "-14px", delay: 90 },
  { y: 72, w: 132, dx: "-34px", dy: "34px", delay: 180 },
];

/* 목록 주변으로 흩어졌다 함께 모이는 작은 조각들. 순전히 장식이라 수를 아꼈다. */
const SPECKS = [
  { x: 6, y: 20, s: 7, dx: "-26px", dy: "-22px", delay: 240 },
  { x: 200, y: 22, s: 6, dx: "30px", dy: "-18px", delay: 300 },
  { x: 12, y: 92, s: 6, dx: "-22px", dy: "26px", delay: 360 },
  { x: 206, y: 88, s: 8, dx: "28px", dy: "24px", delay: 330 },
];

function HeroGraphic() {
  return (
    <svg
      viewBox="0 0 224 108"
      className="h-28 w-full"
      role="presentation"
      aria-hidden="true"
    >
      {ROWS.map((r, i) => (
        <g
          key={`row-${i}`}
          className="gather"
          style={
            {
              "--dx": r.dx,
              "--dy": r.dy,
              animationDelay: `${r.delay}ms`,
            } as React.CSSProperties
          }
        >
          <rect x={24} y={r.y} width={r.w} height={20} rx={6} className="fill-brand-50" />
          <rect x={24} y={r.y} width={5} height={20} rx={2.5} className="fill-brand-600" />
        </g>
      ))}

      {SPECKS.map((s, i) => (
        <rect
          key={`speck-${i}`}
          x={s.x}
          y={s.y}
          width={s.s}
          height={s.s}
          rx={2}
          className="gather fill-brand-200"
          style={
            {
              "--dx": s.dx,
              "--dy": s.dy,
              animationDelay: `${s.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </svg>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-7 px-6 py-12">
      <div className="rise-in">
        <HeroGraphic />
      </div>

      <div>
        <h1 className="rise-in text-6xl font-extrabold tracking-tight text-ink-900" style={{ animationDelay: "80ms" }}>
          Perky<span className="text-brand-600">.</span>
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
          청년 주거 지원금은 국가·전라북도·익산시에 흩어져 있습니다. 질문 네 개만
          답하면 해당될 수 있는 지원금을 한 목록으로 모아 보여드립니다.
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

      <p className="rise-in text-sm leading-relaxed text-ink-500" style={{ animationDelay: "400ms" }}>
        입력한 내용은 브라우저에만 저장되며 서버로 전송되지 않습니다.
      </p>
    </main>
  );
}
