import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // .mts 는 ESM 으로 로드되므로 __dirname 이 없다. import.meta.dirname 을 쓴다.
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  // tsconfig 의 jsx 는 "preserve"(Next 가 변환)라 vitest 가 그대로 두면 .tsx 를 못 읽는다.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    // 기본은 node — lib 테스트가 대부분이고 훨씬 빠르다. 화면 테스트 파일 맨 위에
    // `// @vitest-environment jsdom` 을 적어 파일 단위로 브라우저 환경을 쓴다.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // jsdom 환경을 여러 파일에서 동시에 띄우면 이 환경(WSL2 + /mnt/c)에서 워커가
    // 메모리로 죽는다. 파일을 순차 실행한다 — lib 테스트는 어차피 밀리초 단위다.
    fileParallelism: false,
  },
});
