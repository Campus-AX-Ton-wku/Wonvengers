import { describe, expect, it } from "vitest";
import {
  ITEM_HEIGHT,
  VISIBLE_ROWS,
  WHEEL_HEIGHT,
  WHEEL_PAD,
  clampIndex,
  indexFromScroll,
  scrollTopForIndex,
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
