import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    /*
     * 정적 export 에는 이미지를 리사이즈해 줄 서버가 없다. 기본 로더를 그대로 두면
     * `next build` 가 "Image Optimization ... is not compatible with output: export"
     * 로 실패한다.
     *
     * 원본을 그대로 내보내도 되는 이유: 캐릭터 WebP 8종이 장당 110~155KB 이고
     * 한 화면에 한 장만 쓴다 (docs/디자인/design-tokens.md 의 캐릭터 규칙).
     * 크기가 문제가 되면 로더를 붙이는 게 아니라 원본을 작게 다시 구울 것.
     */
    unoptimized: true,
  },
};

export default nextConfig;
