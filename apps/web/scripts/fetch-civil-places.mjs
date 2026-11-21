// 빌드 전에 서류 떼는 곳 지도의 장소를 받아 data/civil-places.json 을 다시 쓴다.
//
//   node scripts/fetch-civil-places.mjs   # 키가 있으면 받아서 쓰고, 없거나 실패하면 커밋된 파일 그대로
//
// 설계: docs/기획/2026-11-22-서류-떼는-곳-지도-설계.md
// 환경변수(또는 apps/web/.env.local): BOJOGEUM_KEY(공공데이터포털) · KAKAO_REST_KEY(카카오 로컬)
// 이 스크립트는 빌드를 멈추지 않는다 — 지도 데이터가 하루 늦는 것이 배포가 멈추는 것보다 낫다.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IKSAN_EMD, IKSAN_GROUP_CD, JEONBUK_CTPV_CD, decideWrite, formatSnapshot, geocodeQuery, pickOffice, toKiosks, toOffice, usableTotal } from "./civil-places/build.mjs";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB_ROOT, "data", "civil-places.json");
const log = (m) => console.log(`[fetch-civil-places] ${m}`);

function readKey(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  for (const file of [".env.local", ".env"]) {
    try {
      const hit = readFileSync(join(WEB_ROOT, file), "utf8").match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
      if (hit) return hit[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // 파일이 없으면 다음 후보로
    }
  }
  return null;
}

const DATA_KEY = readKey("BOJOGEUM_KEY");
const KAKAO_KEY = readKey("KAKAO_REST_KEY");

const DEADLINE_MS = 90_000;
const CONCURRENCY = 5;
const deadline = AbortSignal.timeout(DEADLINE_MS);

/** 주소(키가 든 URL)를 오류 문구에 싣지 않는다 */
async function getJson(url, headers = {}, attempt = 1) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.any([AbortSignal.timeout(15_000), deadline]) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (deadline.aborted || attempt >= 3) throw new Error(err?.message ?? "요청 실패");
    await new Promise((r) => setTimeout(r, 1_500 * attempt));
    return getJson(url, headers, attempt + 1);
  }
}

/** items 를 동시에 CONCURRENCY 개씩 처리 — 결과 순서는 입력 순서 그대로 */
async function mapLimit(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const ROWS = 100;

/** 무인민원발급기 API 한 오퍼레이션을 끝까지 받는다. 첫 쪽의 totalCount 로 나머지를 동시에 받는다 */
async function allRows(op, cond) {
  const page = async (n) => {
    const url = new URL(`https://apis.data.go.kr/1741000/kiosk_info/${op}`);
    url.searchParams.set("serviceKey", DATA_KEY);
    url.searchParams.set("pageNo", String(n));
    url.searchParams.set("numOfRows", String(ROWS));
    url.searchParams.set("returnType", "json");
    for (const [k, v] of Object.entries(cond)) url.searchParams.set(k, v);
    const body = (await getJson(url)).response?.body;
    return { items: [].concat(body?.items?.item ?? []), total: usableTotal(body?.totalCount) };
  };
  const first = await page(1);
  const rows = [...first.items];
  if (first.total !== null) {
    const needed = Math.ceil(first.total / ROWS);
    if (needed > 199) throw new Error(`쪽 수 상한(199)을 넘었어요: ${op} ${needed}쪽`);
    const pages = needed;
    const rest = await mapLimit(Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => i + 2), async (n) => (await page(n)).items);
    return rows.concat(...rest);
  }
  // totalCount 가 없으면 한 쪽이 덜 찰 때까지 순서대로 (쪽 수 상한 199)
  let last = first.items.length;
  for (let n = 2; last >= ROWS && n < 200; n++) {
    const { items } = await page(n);
    rows.push(...items);
    last = items.length;
  }
  if (last >= ROWS) throw new Error(`쪽 수 상한(199)까지 끝나지 않았어요: ${op}`);
  return rows;
}

const kakao = (path, query) =>
  getJson(`https://dapi.kakao.com/v2/local/search/${path}.json?${new URLSearchParams(query)}`, {
    Authorization: `KakaoAK ${KAKAO_KEY}`,
  });

function committedCount() {
  try {
    return JSON.parse(readFileSync(OUT, "utf8")).places?.length ?? 0;
  } catch {
    return 0;
  }
}

async function main() {
  if (process.env.VERCEL_ENV === "preview") {
    log("미리보기 빌드 — 받지 않고 커밋된 data/civil-places.json 을 그대로 쓴다");
    return;
  }
  if (!DATA_KEY || !KAKAO_KEY) {
    log("BOJOGEUM_KEY · KAKAO_REST_KEY 중 없는 키가 있다 — 커밋된 data/civil-places.json 을 그대로 쓴다");
    return;
  }
  const before = committedCount();

  const found = await mapLimit(IKSAN_EMD, async (emd) => {
    try {
      const { documents = [] } = await kakao("keyword", { query: `익산 ${emd} 행정복지센터`, size: "5" });
      const hit = pickOffice(emd, documents);
      if (hit) return toOffice(emd, hit);
      log(`주민센터를 못 찾음: ${emd} (카카오 후보: ${documents.map((d) => `${d.place_name}/${d.category_group_code}/${d.address_name}`).join(" | ") || "없음"})`);
    } catch (err) {
      if (deadline.aborted) throw err;
      log(`주민센터 검색 실패: ${emd}`);
    }
    return null;
  });
  const offices = found.filter(Boolean);

  const install = await allRows("installation_info", { "cond[CTPV_CD::EQ]": JEONBUK_CTPV_CD });
  const certs = await allRows("certificate_info", { "cond[SGG_NM::LIKE]": "익산" });
  const targets = install.filter((r) => r.OPN_ATMY_GRP_CD === IKSAN_GROUP_CD && r.USE_YN_NM === "사용");
  const coords = new Map();
  await mapLimit(targets, async (r) => {
    try {
      const { documents = [] } = await kakao("address", { query: geocodeQuery(r.INSTL_PLC_ADDR) });
      if (!documents[0]) return;
      if (!String(documents[0].address_name ?? "").includes("익산시")) {
        log(`주소 검색 결과가 익산이 아님: ${r.MNG_NO} ${r.ISSUMCHN_NM}`);
        return;
      }
      coords.set(r.MNG_NO, { lat: Number(documents[0].y), lng: Number(documents[0].x) });
    } catch (err) {
      if (deadline.aborted) throw err;
      log(`주소 검색 실패: ${r.MNG_NO} ${r.ISSUMCHN_NM}`);
    }
  });
  const { places: kiosks, skipped } = toKiosks(install, certs, coords);
  for (const s of skipped) log(`발급기 뺌: ${s}`);

  if (deadline.aborted) {
    log("전체 90초 제한 초과 — 덮어쓰지 않는다");
    return;
  }
  const decision = decideWrite({ offices: offices.length, kiosks: kiosks.length, committedCount: before });
  if (!decision.write) {
    log(`덮어쓰지 않는다 — ${decision.reason} (주민센터 ${offices.length} · 발급기 ${kiosks.length} · 커밋 ${before})`);
    return;
  }
  const places = [...offices, ...kiosks];
  const generatedAt = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  writeFileSync(OUT, formatSnapshot({ generatedAt, places }));
  log(`주민센터 ${offices.length}곳 · 발급기 ${kiosks.length}대 → data/civil-places.json`);
}

main().catch((err) => log(`실패 — 커밋된 파일을 그대로 쓴다: ${deadline.aborted ? "전체 90초 제한 초과" : err.message}`));
