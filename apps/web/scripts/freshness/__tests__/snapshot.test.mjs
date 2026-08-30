import { describe, expect, it } from "vitest";
import { diffSnapshots, fingerprintRecord } from "../snapshot.mjs";

/**
 * 보조금24 의 지원대상·선정기준·지원내용은 자유 서술 텍스트다. 파싱해서
 * 나이나 날짜를 뽑아내려 하면 틀린다 ("만 19~34세 이하*", "2026년 상반기").
 *
 * 그래서 해석을 포기하고 **바뀌었다는 사실만** 잡는다. 지문이 달라지면
 * 사람에게 "이 정책 뭔가 바뀜"이라고 알리고, 해석은 사람이 한다.
 */
describe("fingerprintRecord", () => {
  it("공백과 줄바꿈만 다르면 같은 지문이다 — 편집 흔적으로 알림이 울리면 안 된다", () => {
    const a = fingerprintRecord({ 지원대상: "만 19~34세  청년", 지원내용: "월 20만원" });
    const b = fingerprintRecord({ 지원대상: "만 19~34세 청년", 지원내용: "월 20만원\n" });

    expect(a).toBe(b);
  });

  it("지원 금액이 바뀌면 지문이 달라진다", () => {
    const before = fingerprintRecord({ 지원대상: "만 19~34세 청년", 지원내용: "월 20만원" });
    const after = fingerprintRecord({ 지원대상: "만 19~34세 청년", 지원내용: "월 25만원" });

    expect(after).not.toBe(before);
  });
});

/**
 * 익산 주거 사업 목록의 주 단위 변화.
 *
 * spike 시점 익산 `주거·자립` 은 8건이고, 그중 청년 현금성 지원은 사실상 없다.
 * 0건이어도 감시는 의미가 있다 — 등록되는 순간 잡히는 게 목적이다.
 */
describe("diffSnapshots", () => {
  const 기준 = {
    "468000000111": { name: "귀농귀촌 정착 지원", fingerprint: "aaaa" },
    "468000000222": { name: "전입세대 전입장려금", fingerprint: "bbbb" },
  };

  it("새로 등록된 사업을 신규로 집는다", () => {
    const 다음 = { ...기준, "468000000333": { name: "익산시 청년 이사비 지원", fingerprint: "cccc" } };

    const diff = diffSnapshots(기준, 다음);

    expect(diff.신규).toEqual([
      { id: "468000000333", name: "익산시 청년 이사비 지원" },
    ]);
  });

  it("지문이 달라진 사업을 변경으로 집는다", () => {
    const 다음 = { ...기준, "468000000222": { name: "전입세대 전입장려금", fingerprint: "zzzz" } };

    const diff = diffSnapshots(기준, 다음);

    expect(diff.변경).toEqual([
      { id: "468000000222", name: "전입세대 전입장려금" },
    ]);
    expect(diff.신규).toEqual([]);
  });

  it("사라진 사업을 집는다 — 사업 종료일 수 있으므로 조용히 넘기면 안 된다", () => {
    const 다음 = { "468000000111": 기준["468000000111"] };

    const diff = diffSnapshots(기준, 다음);

    expect(diff.사라짐).toEqual([
      { id: "468000000222", name: "전입세대 전입장려금" },
    ]);
  });
});
