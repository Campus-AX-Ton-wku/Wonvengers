import { describe, expect, it } from "vitest";
import policies from "@/data/policies.json";
import { GET, dynamic } from "@/app/policies.json/route";

describe("/policies.json — 알림 서버가 읽는 공개 정책 목록", () => {
  it("빌드 때 굽는다 (정적 export)", () => {
    expect(dynamic).toBe("force-static");
  });

  it("data/policies.json 을 그대로 돌려준다", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(policies);
  });
});
