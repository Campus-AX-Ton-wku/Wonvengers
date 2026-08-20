import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // .mts 는 ESM 으로 로드되므로 __dirname 이 없다. import.meta.dirname 을 쓴다.
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
