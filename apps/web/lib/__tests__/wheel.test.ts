import { describe, expect, it } from "vitest";
import {
  ITEM_HEIGHT,
  TYPE_AHEAD_MS,
  VISIBLE_ROWS,
  WHEEL_HEIGHT,
  WHEEL_PAD,
  clampIndex,
  indexFromScroll,
  scrollTopForIndex,
  typeAheadMatch,
} from "@/lib/wheel";

/*
 * 스크롤 감각은 jsdom 에서 볼 수 없다(레이아웃이 없어 scrollTop 이 항상 0). 여기서는
 * "몇 번째가 가운데 왔는가" 계산만 고정한다. 이게 틀리면 손가락을 뗀 자리와 저장되는
 * 값이 어긋나고, 그게 이 UI 에서 제일 나쁜 고장이다.
 */

describe("휠 치수", () => {
  it("보이는 줄 수가 홀수다 — 가운데 한 줄이 선택 위치가 되어야 한다", () => {
    expect(VISIBLE_ROWS % 2).toBe(1);
  });

  it("위아래 여백은 첫·마지막 항목도 가운데 올 만큼이다", () => {
    expect(WHEEL_PAD).toBe((WHEEL_HEIGHT - ITEM_HEIGHT) / 2);
    expect(WHEEL_HEIGHT).toBe(ITEM_HEIGHT * VISIBLE_ROWS);
  });
});

describe("스크롤 위치 ↔ 인덱스", () => {
  it("스크롤 0 은 첫 항목이다", () => {
    expect(indexFromScroll(0, 12)).toBe(0);
  });

  it("한 항목 높이만큼 굴리면 다음 항목이다", () => {
    expect(indexFromScroll(ITEM_HEIGHT, 12)).toBe(1);
    expect(indexFromScroll(ITEM_HEIGHT * 5, 12)).toBe(5);
  });

  // 스냅이 끝나도 소수점 오차가 남는다. 반올림하지 않으면 한 칸씩 밀린다.
  it("스냅 오차를 반올림한다", () => {
    expect(indexFromScroll(ITEM_HEIGHT * 3 + 4, 12)).toBe(3);
    expect(indexFromScroll(ITEM_HEIGHT * 3 - 4, 12)).toBe(3);
    expect(indexFromScroll(ITEM_HEIGHT * 3 + ITEM_HEIGHT / 2 + 1, 12)).toBe(4);
  });

  it("목록 밖으로 나가지 않는다 — 관성으로 넘겨도 마지막 항목에 멈춘다", () => {
    expect(indexFromScroll(ITEM_HEIGHT * 999, 12)).toBe(11);
    expect(indexFromScroll(-500, 12)).toBe(0);
  });

  it("빈 목록에서도 죽지 않는다", () => {
    expect(indexFromScroll(0, 0)).toBe(0);
    expect(clampIndex(5, 0)).toBe(0);
  });

  it("왕복해도 같은 항목을 가리킨다", () => {
    for (const i of [0, 1, 7, 11]) {
      expect(indexFromScroll(scrollTopForIndex(i), 12)).toBe(i);
    }
  });
});

/*
 * 타이핑 점프. 네이티브 select 가 주던 것 중 마지막으로 채운 조각이다.
 * 생년 목록은 28개라 화살표만으로는 멀어서, 이게 없으면 키보드 사용자가 제일 손해다.
 */
describe("타이핑 점프", () => {
  const 월 = Array.from({ length: 12 }, (_, i) => i + 1);
  const 일 = Array.from({ length: 31 }, (_, i) => i + 1);
  /** 생년은 내림차순이다 (2008 → 1981). 목록 순서가 결과를 바꾼다. */
  const 생년 = Array.from({ length: 28 }, (_, i) => 2008 - i);

  it("한 자리를 누르면 그 숫자로 간다", () => {
    expect(typeAheadMatch(월, "9")).toBe(9);
    expect(typeAheadMatch(일, "3")).toBe(3);
  });

  it("이어 치면 좁혀진다 — 1 다음 2 는 12월", () => {
    expect(typeAheadMatch(월, "1")).toBe(1);
    expect(typeAheadMatch(월, "12")).toBe(12);
    expect(typeAheadMatch(일, "31")).toBe(31);
  });

  it("앞자리 일치이고 목록 순서대로 처음 맞는 것을 준다", () => {
    // 생년 목록이 내림차순이라 "20" 은 2008 이 먼저다
    expect(typeAheadMatch(생년, "20")).toBe(2008);
    expect(typeAheadMatch(생년, "200")).toBe(2008);
    expect(typeAheadMatch(생년, "2003")).toBe(2003);
    expect(typeAheadMatch(생년, "199")).toBe(1999);
  });

  it("없는 숫자열은 null 이다 — 호출하는 쪽이 버퍼를 버린다", () => {
    expect(typeAheadMatch(생년, "9")).toBeNull(); // 9 로 시작하는 생년은 없다
    expect(typeAheadMatch(월, "13")).toBeNull();
    expect(typeAheadMatch(월, "0")).toBeNull();
  });

  it("빈 버퍼는 null 이다", () => {
    expect(typeAheadMatch(월, "")).toBeNull();
    expect(typeAheadMatch([], "1")).toBeNull();
  });

  // 짧으면 "31" 을 치는 동안 끊겨 3일로 가고, 길면 다음에 누른 숫자가 앞에 붙는다.
  it("버퍼 유지 시간이 네이티브 select 와 같은 1초다", () => {
    expect(TYPE_AHEAD_MS).toBe(1000);
  });
});
