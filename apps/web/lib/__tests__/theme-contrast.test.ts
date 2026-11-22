import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** globals.css 를 그대로 읽어 밝게(@theme) · 어둡게([data-theme="dark"] 덮개) 토큰을 뽑고 대비를 잰다 — 값만 바꾸고 다시 안 재는 일이 없게. */
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

function tokens(open: RegExp): Record<string, string> {
  const m = open.exec(css);
  if (!m) throw new Error(`블록 없음: ${open}`);
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  const out: Record<string, string> = {};
  for (const [, name, hex] of css.slice(start, i - 1).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[name] = hex.toLowerCase();
  return out;
}

const light = tokens(/@theme\s*\{/);
const dark = { ...light, ...tokens(/^\[data-theme="dark"\]\s*\{/m) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const color = (set: Record<string, string>, name: string) => (name === "white" ? "#ffffff" : set[name]);

/** [글자/아이콘, 바탕, 최소 대비] — 토큰 주석의 쓰임대로 */
const PAIRS: [string, string, number][] = [
  ["ink-900", "surface", 4.5], ["ink-900", "canvas", 4.5], ["ink-700", "surface", 4.5],
  ["ink-600", "surface", 4.5], ["ink-600", "canvas", 4.5], ["ink-600", "ink-100", 4.5], ["ink-600", "ink-50", 4.5],
  ["ink-500", "surface", 4.5], ["ink-500", "canvas", 4.5],
  ["brand-700", "surface", 4.5], ["brand-800", "brand-50", 4.5], ["brand-900", "surface", 4.5], ["brand-900", "brand-50", 4.5],
  ["ok-700", "surface", 4.5], ["ok-700", "ok-50", 4.5], ["warn-800", "warn-50", 4.5],
  ["danger-700", "surface", 4.5], ["danger-700", "danger-50", 4.5],
  ["white", "brand-600", 4.5], ["white", "brand-press", 4.5], ["white", "danger-600", 4.5], ["white", "danger-press", 4.5],
  ["brand-600", "surface", 3],
];

describe.each([
  ["밝게", light],
  ["어둡게", dark],
] as const)("%s — 글씨 4.5:1 · 아이콘 3:1", (_, set) => {
  it.each(PAIRS)("%s on %s ≥ %s", (fg, bg, min) => {
    expect(color(set, fg), fg).toBeTruthy();
    expect(color(set, bg), bg).toBeTruthy();
    expect(contrast(color(set, fg), color(set, bg))).toBeGreaterThanOrEqual(min);
  });
});

it("어둡게는 지면이 실제로 어둡다 — 덮개가 빠지지 않았는지", () => {
  expect(luminance(dark.canvas)).toBeLessThan(0.05);
  expect(luminance(dark.surface)).toBeLessThan(0.05);
  expect(dark["ink-900"]).not.toBe(light["ink-900"]);
});
