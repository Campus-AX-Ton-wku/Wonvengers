import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-semibold tracking-wide text-sky-600">Perky</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-snug text-slate-900">
          받을 수 있는
          <br />
          주거 지원금부터 확인하세요
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          청년 주거 지원금은 국가·전라북도·익산시에 흩어져 있습니다. 질문 네 개만
          답하면 해당될 수 있는 지원금을 한 목록으로 모아 보여드립니다.
        </p>
      </div>

      <Link
        href="/find"
        className="rounded-xl bg-sky-600 px-6 py-4 text-center text-lg font-bold text-white active:bg-sky-700"
      >
        내 지원금 찾아보기
      </Link>

      <p className="text-sm leading-relaxed text-slate-500">
        입력한 내용은 브라우저에만 저장되며 서버로 전송되지 않습니다.
      </p>
    </main>
  );
}
