// 앱 아이콘 바탕을 브랜드 파랑 하나로 맞추고 파생 4종을 다시 굽는다 (docs/기획/2026-11-20-앱-시작-화면-설계.md "파랑 하나로").
//
//   node scripts/build-app-icons.mjs
//
// 마스터(docs/디자인/아이콘/perky-icon-2048.png)는 흰 마크 + 평면 바탕이다(고유 색 35개 — 바탕과 흰색 사이의 가장자리 섞임뿐).
// 픽셀마다 '바탕 ↔ 흰색' 섞인 비율을 재서 같은 비율로 새 바탕과 다시 섞는다 — 마크 모양 · 가장자리 부드러움은 그대로다.
// 마스터가 이미 새 바탕이면 색 바꾸기는 건너뛰고 파생만 다시 굽는다(여러 번 돌려도 같다).
// 그림 처리는 Playwright 의 브라우저 캔버스로 한다 — 이 저장소에는 이미지 도구가 없다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const MASTER = `${ROOT}docs/디자인/아이콘/perky-icon-2048.png`;
const OLD_BG = [0x2f, 0x6b, 0xff];
const NEW_BG = [0x1a, 0x6b, 0xef]; // brand-600 — globals.css · 매니페스트 · 스플래시와 같은 값
const OUT = [
  { path: "apps/web/app/icon.png", size: 512, scale: 1 },
  { path: "apps/web/app/apple-icon.png", size: 180, scale: 1 },
  { path: "apps/web/public/icon-192.png", size: 192, scale: 1 },
  // 안드로이드가 원형으로 깎아도 마크가 남게 85% 로 줄여 가운데 (README '안드로이드 adaptive icon')
  { path: "apps/web/public/icon-maskable-512.png", size: 512, scale: 0.85 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
const master = `data:image/png;base64,${readFileSync(MASTER).toString("base64")}`;

const result = await page.evaluate(
  async ({ master, OLD_BG, NEW_BG, OUT }) => {
    const img = new Image();
    img.src = master;
    await img.decode();
    const base = document.createElement("canvas");
    base.width = img.width;
    base.height = img.height;
    const bx = base.getContext("2d");
    bx.drawImage(img, 0, 0);
    const data = bx.getImageData(0, 0, base.width, base.height);
    const px = data.data;
    const already = px[0] === NEW_BG[0] && px[1] === NEW_BG[1] && px[2] === NEW_BG[2];
    if (!already) {
      for (let i = 0; i < px.length; i += 4) {
        // 흰색까지 거리가 충분한 채널(R · G)로 섞인 비율 t 를 잰다. B 는 바탕이 이미 255 라 쓸 수 없다
        let sum = 0;
        let n = 0;
        for (let c = 0; c < 3; c++) {
          const span = 255 - OLD_BG[c];
          if (span < 32) continue;
          sum += (px[i + c] - OLD_BG[c]) / span;
          n++;
        }
        const t = Math.min(1, Math.max(0, sum / n));
        for (let c = 0; c < 3; c++) px[i + c] = Math.round(NEW_BG[c] + t * (255 - NEW_BG[c]));
        px[i + 3] = 255;
      }
      bx.putImageData(data, 0, 0);
    }
    const toPng = (canvas) => canvas.toDataURL("image/png").split(",")[1];
    // 큰 그림을 한 번에 1/10 로 줄이면 가장자리가 거칠다 — 반씩 줄여 내려간다
    const shrink = (src, target) => {
      let cur = src;
      while (cur.width / 2 >= target) {
        const next = document.createElement("canvas");
        next.width = cur.width / 2;
        next.height = cur.height / 2;
        const nx = next.getContext("2d");
        nx.imageSmoothingQuality = "high";
        nx.drawImage(cur, 0, 0, next.width, next.height);
        cur = next;
      }
      return cur;
    };
    const outputs = OUT.map(({ path, size, scale }) => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const x = c.getContext("2d");
      x.fillStyle = `rgb(${NEW_BG.join(",")})`;
      x.fillRect(0, 0, size, size);
      const inner = Math.round(size * scale);
      x.imageSmoothingQuality = "high";
      x.drawImage(shrink(base, inner), (size - inner) / 2, (size - inner) / 2, inner, inner);
      return { path, png: toPng(c) };
    });
    return { already, master: already ? null : toPng(base), outputs };
  },
  { master, OLD_BG, NEW_BG, OUT }
);

if (result.master) writeFileSync(MASTER, Buffer.from(result.master, "base64"));
for (const { path, png } of result.outputs) writeFileSync(`${ROOT}${path}`, Buffer.from(png, "base64"));
await browser.close();
console.log(`${result.already ? "마스터는 이미 새 바탕" : "마스터 바탕 #2f6bff → #1a6bef"} · 파생 ${result.outputs.length}종 다시 구움`);
