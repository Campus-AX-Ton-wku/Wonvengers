import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 폰트 서브셋이 화면에 나오는 한글을 다 담고 있는지.
 *
 * app/fonts/Pretendard-subset.woff2 는 전체 Pretendard(2,009KB)에서 이 앱이
 * 실제로 쓰는 글자만 남긴 141KB 짜리다. 그래서 **새 글자가 들어오면 조용히
 * 깨진다** — 서브셋에 없는 음절은 폴백 폰트로 그려져 문장 중간에서 글꼴이
 * 바뀐다. 캡처에서나 발견될 종류의 사고다.
 *
 * lib/steps.ts 의 질문 키가 그룹에서 빠지면 steps.test.ts 가 잡는 것과 같은
 * 자리다. 정책 데이터에 새 문구가 들어오면 이 테스트가 먼저 실패해야 한다.
 *
 * 고치는 방법은 실패 메시지에 적어둔다 — 서브셋을 다시 만들면 된다.
 */

const WEB = resolve(__dirname, "../..");
const CHARSET = join(WEB, "app/fonts/subset-charset.txt");

/** 화면에 나올 수 있는 텍스트가 든 파일 — 컴포넌트와 정책 데이터. */
function 텍스트파일들(): string[] {
  const 결과: string[] = [];
  const 훑기 = (dir: string) => {
    for (const 이름 of readdirSync(dir)) {
      const 경로 = join(dir, 이름);
      if (statSync(경로).isDirectory()) {
        if (이름 === "__tests__" || 이름 === "node_modules" || 이름 === "fonts") continue;
        훑기(경로);
        continue;
      }
      if (/\.(tsx|ts)$/.test(이름) && !이름.endsWith(".test.ts")) 결과.push(경로);
      if (/\.json$/.test(이름)) 결과.push(경로);
    }
  };
  훑기(join(WEB, "app"));
  훑기(join(WEB, "lib"));
  훑기(join(WEB, "data"));
  return 결과;
}

function 한글만(text: string): Set<string> {
  return new Set([...text].filter((c) => c >= "가" && c <= "힣"));
}

describe("폰트 서브셋", () => {
  it("앱이 렌더하는 한글을 모두 담고 있다", () => {
    const 서브셋 = 한글만(readFileSync(CHARSET, "utf-8"));

    const 빠진것 = new Map<string, string>(); // 글자 → 처음 발견한 파일
    for (const 파일 of 텍스트파일들()) {
      for (const 글자 of 한글만(readFileSync(파일, "utf-8"))) {
        if (!서브셋.has(글자) && !빠진것.has(글자)) {
          빠진것.set(글자, 파일.replace(WEB + "/", ""));
        }
      }
    }

    const 메시지 =
      빠진것.size === 0
        ? ""
        : `서브셋에 없는 글자 ${빠진것.size}개: ` +
          [...빠진것].map(([c, f]) => `'${c}'(${f})`).join(", ") +
          "\n→ 서브셋을 다시 만들 것: python3 scripts/build-font-subset.py --source <PretendardVariable.woff2>";

    expect(메시지, 메시지).toBe("");
  });

  /* 서브셋이 비어 있거나 라틴만 있으면 위 검사가 통과할 수 없다. 그래도 파일이
     잘못 생성됐을 때 원인이 '글자 578개 빠짐' 으로 보이면 헷갈리므로 따로 본다. */
  it("서브셋 목록이 한글을 담고 있다 — 라틴 전용 파일을 잘못 넣지 않았는지", () => {
    expect(한글만(readFileSync(CHARSET, "utf-8")).size).toBeGreaterThan(400);
  });
});
