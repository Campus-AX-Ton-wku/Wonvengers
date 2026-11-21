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
import { IKSAN_EMD, IKSAN_GROUP_CD, JEONBUK_CTPV_CD, formatSnapshot, geocodeQuery, pickOffice, toKiosks, toOffice } from "./civil-places/build.mjs";

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

async function getJson(url, headers = {}, attempt = 1) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1_500 * attempt));
    return getJson(url, headers, attempt + 1);
  }
}

/** 무인민원발급기 API 한 오퍼레이션을 끝까지 넘겨 받는다 */
async function allRows(op, cond) {
  const rows = [];
  for (let page = 1; page < 200; page++) {
    const url = new URL(`https://apis.data.go.kr/1741000/kiosk_info/${op}`);
    url.searchParams.set("serviceKey", DATA_KEY);
    url.searchParams.set("pageNo", String(page));
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("returnType", "json");
    for (const [k, v] of Object.entries(cond)) url.searchParams.set(k, v);
    const body = (await getJson(url)).response?.body;
    const items = [].concat(body?.items?.item ?? []);
    rows.push(...items);
    if (items.length < 100 || rows.length >= Number(body?.totalCount ?? 0)) break;
  }
  return rows;
}

const kakao = (path, query) =>
  getJson(`https://dapi.kakao.com/v2/local/search/${path}.json?${new URLSearchParams(query)}`, {
    Authorization: `KakaoAK ${KAKAO_KEY}`,
  });

async function main() {
  if (!DATA_KEY || !KAKAO_KEY) {
    log("BOJOGEUM_KEY · KAKAO_REST_KEY 중 없는 키가 있다 — 커밋된 data/civil-places.json 을 그대로 쓴다");
    return;
  }

  const offices = [];
  for (const emd of IKSAN_EMD) {
    const { documents = [] } = await kakao("keyword", { query: `익산 ${emd} 행정복지센터`, size: "5" });
    const hit = pickOffice(emd, documents);
    if (hit) offices.push(toOffice(emd, hit));
    else log(`주민센터를 못 찾음: ${emd} (카카오 후보: ${documents.map((d) => `${d.place_name}/${d.category_group_code}/${d.address_name}`).join(" | ") || "없음"})`);
  }

  const install = await allRows("installation_info", { "cond[CTPV_CD::EQ]": JEONBUK_CTPV_CD });
  const certs = await allRows("certificate_info", { "cond[SGG_NM::LIKE]": "익산" });
  const coords = new Map();
  for (const r of install) {
    if (r.OPN_ATMY_GRP_CD !== IKSAN_GROUP_CD || r.USE_YN_NM !== "사용") continue;
    const { documents = [] } = await kakao("address", { query: geocodeQuery(r.INSTL_PLC_ADDR) });
    if (documents[0]) coords.set(r.MNG_NO, { lat: Number(documents[0].y), lng: Number(documents[0].x) });
  }
  const { places: kiosks, skipped } = toKiosks(install, certs, coords);
  for (const s of skipped) log(`발급기 뺌: ${s}`);

  const places = [...offices, ...kiosks];
  if (places.length === 0) {
    log("받은 장소가 0곳 — 덮어쓰지 않는다");
    return;
  }
  const generatedAt = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  writeFileSync(OUT, formatSnapshot({ generatedAt, places }));
  log(`주민센터 ${offices.length}곳 · 발급기 ${kiosks.length}대 → data/civil-places.json`);
}

main().catch((err) => log(`실패 — 커밋된 파일을 그대로 쓴다: ${err.message}`));
