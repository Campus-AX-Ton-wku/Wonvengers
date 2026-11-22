"use client";

import { useEffect } from "react";
import { markGuideRead } from "@/lib/storage";

/** 가이드 끝 장을 열면 '읽음'으로 남긴다 — '가이드 정독' 배지 재료(11/22 내 프로필 ②). 이 기기에만, 그리는 것은 없다 */
export function MarkGuideRead({ id }: { id: string }) {
  useEffect(() => {
    markGuideRead(id);
  }, [id]);
  return null;
}
