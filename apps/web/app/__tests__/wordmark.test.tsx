// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "@/app/components";

it("로고는 한 장(alt 'Perky')이고, 다크에서 바꿔 끼울 표(wordmark)를 단다", () => {
  render(<Wordmark />);
  const img = screen.getByAltText("Perky");
  expect(img.className).toContain("wordmark");
});

it("다크용 로고 파일은 배경 사각형이 없고 남색 글자를 밝게 바꿨다", () => {
  const svg = readFileSync(join(__dirname, "../../public/brand/perky-wordmark-dark.svg"), "utf8");
  expect(svg).not.toMatch(/fill="#F5F5F5"|fill="#F5F8FF"/i);
  expect(svg).not.toMatch(/#0A234E/i);
  expect(svg).toMatch(/#EDF3FA/i);
  expect(svg).toMatch(/#1B64FE/i);
});

it("globals.css 가 다크에서 로고 그림을 바꾼다", () => {
  const css = readFileSync(join(__dirname, "../globals.css"), "utf8");
  expect(css).toMatch(/\[data-theme="dark"\] img\.wordmark\s*\{\s*content: url\("\/brand\/perky-wordmark-dark\.svg"\);/);
});
