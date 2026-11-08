import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // 스택 하나를 synth 하는 데 몇 초 걸린다.
    testTimeout: 60_000,
  },
});
