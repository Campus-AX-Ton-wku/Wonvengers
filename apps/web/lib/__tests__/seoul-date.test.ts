import { describe, expect, it } from "vitest";
import { seoulTodayISO } from "@/lib/date";

describe("seoulTodayISO", () => {
  it("UTC 15:30 은 서울 다음 날 00:30 이다", () => {
    expect(seoulTodayISO(new Date("2026-11-16T15:30:00Z"))).toBe("2026-11-17");
  });
  it("UTC 14:59 는 서울 같은 날 23:59 이다", () => {
    expect(seoulTodayISO(new Date("2026-11-17T14:59:00Z"))).toBe("2026-11-17");
  });
});
