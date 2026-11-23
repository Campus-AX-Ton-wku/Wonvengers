import { describe, expect, it } from "vitest";
import { GET, dynamic } from "@/app/notices.json/route";
import snapshot from "@/data/notices.json";

describe("/notices.json — 알림 서버가 읽는 공고 목록", () => {
  it("빌드 때 굽는 정적 경로이고, data/notices.json 그대로다", async () => {
    expect(dynamic).toBe("force-static");
    expect(await GET().json()).toEqual(snapshot);
  });
});
