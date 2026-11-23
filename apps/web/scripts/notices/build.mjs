// 익산 청약 공고 모으기의 순수 함수 (I/O 는 ../fetch-notices.mjs). 설계: docs/기획/2026-11-22-청약-공고-설계.md §0 · §1
// 11/22 시험: 마이홈은 익산 코드로 바로, 청약홈은 지역 코드가 없어 공급지역 '전북' → 주소 '익산'.

export const MYHOME = "https://apis.data.go.kr/1613000/HWSPR02";
export const APPLYHOME = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
export const MYHOME_BRTC = "52"; // 전북특별자치도 (옛 45 는 NODATA)
export const MYHOME_SIGNGU = "140"; // 익산시
const ROWS = 100;
const MAX_PAGES = 40; // 청약홈이 지역 조건을 무시해도 전국(약 3천 건)을 다 받을 수 있게

const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const link = (v) => (typeof v === "string" && /^https?:\/\//.test(v.trim()) ? v.trim() : null);

/** "20261123" · "2026-11-23" → "2026-11-23", 그 밖은 null */
export function ymd(raw) {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(String(raw ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * 마이홈 응답의 줄 — 한 건이면 객체로, NODATA(03) 면 body 없이 온다.
 * 그 밖의 오류 코드(키 · 트래픽 등)는 HTTP 200 안에 담겨 오므로 던진다 — 0건으로 읽으면 반쪽 목록이 굳는다(리뷰 I-3).
 */
export function myhomeRows(json) {
  const code = json?.response?.header?.resultCode;
  if (code !== undefined && code !== "00" && code !== "03") throw new Error(`myhome resultCode ${code}`);
  const body = json?.response?.body ?? json?.body;
  const items = body?.item ?? body?.items?.item ?? body?.items ?? [];
  return Array.isArray(items) ? items : [items];
}

/** kind: "공공임대"(rsdtRcritNtcList) · "공공분양"(ltRsdtRcritNtcList) */
export function fromMyhome(row, kind) {
  const title = text(row?.pblancNm);
  const url = link(row?.url) ?? link(row?.pcUrl) ?? link(row?.mobileUrl);
  if (!row?.pblancId || !title || !url) return null;
  return {
    id: `myhome:${row.pblancId}`,
    source: "마이홈포털",
    kind,
    typeLabel: kind === "공공임대" ? (text(row.suplyTyNm) ?? "공공임대") : "공공분양",
    title,
    supplier: text(row.suplyInsttNm),
    announcedAt: ymd(row.rcritPblancDe),
    applyStart: ymd(row.beginDe),
    applyEnd: ymd(row.endDe),
    url,
    address: text(row.fullAdres),
    replaces: text(row.beforePblancId) ? `myhome:${row.beforePblancId}` : null,
  };
}

/**
 * kind: "아파트 분양"(getAPTLttotPblancDetail) · "무순위 · 잔여"(getRemndrLttotPblancDetail).
 * 접수 = 특별공급 · 일반 접수 시작 중 이른 날 ~ 접수 마감 중 늦은 날 (설계 §1 — 구현 때 공고 원문 한 건과 대조).
 */
export function fromApplyhome(row, kind) {
  const address = text(row?.HSSPLY_ADRES);
  const title = text(row?.HOUSE_NM);
  const url = link(row?.PBLANC_URL) ?? link(row?.HMPG_ADRES);
  if (!address?.includes("익산") || !title || !url || !row?.HOUSE_MANAGE_NO) return null;
  const starts = [row.SPSPLY_RCEPT_BGNDE, row.RCEPT_BGNDE, row.SUBSCRPT_RCEPT_BGNDE, row.GNRL_RCEPT_BGNDE].map(ymd).filter(Boolean).sort();
  const ends = [row.SPSPLY_RCEPT_ENDDE, row.RCEPT_ENDDE, row.SUBSCRPT_RCEPT_ENDDE, row.GNRL_RCEPT_ENDDE].map(ymd).filter(Boolean).sort();
  return {
    id: `applyhome:${row.HOUSE_MANAGE_NO}-${row.PBLANC_NO ?? ""}`,
    source: "청약홈",
    kind,
    typeLabel: kind,
    title,
    supplier: text(row.BSNS_MBY_NM),
    announcedAt: ymd(row.RCRIT_PBLANC_DE),
    applyStart: starts[0] ?? null,
    applyEnd: ends.at(-1) ?? null,
    url,
    address,
  };
}

/** 같은 공고는 한 번, 정정공고가 대신한 공고 · 끝난 공고 · 기간이 없는 공고는 뺀다 */
export function mergeNotices(list, today) {
  const replaced = new Set(list.map((n) => n?.replaces).filter(Boolean));
  const seen = new Set();
  const out = [];
  for (const n of list) {
    if (!n || replaced.has(n.id) || seen.has(n.id)) continue;
    if (!n.applyStart && !n.applyEnd) continue;
    if (n.applyEnd && n.applyEnd < today) continue;
    seen.add(n.id);
    const { replaces: _replaces, ...notice } = n;
    out.push(notice);
  }
  return out;
}

export function formatSnapshot(notices, generatedAt) {
  return `${JSON.stringify({ generatedAt, notices }, null, 2)}\n`;
}

async function myhomeAll(fetchJson, key, op) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const u = new URL(`${MYHOME}/${op}`);
    u.searchParams.set("serviceKey", key);
    u.searchParams.set("brtcCode", MYHOME_BRTC);
    u.searchParams.set("signguCode", MYHOME_SIGNGU);
    u.searchParams.set("pageNo", String(page));
    u.searchParams.set("numOfRows", String(ROWS));
    const got = myhomeRows(await fetchJson(u.toString()));
    rows.push(...got);
    if (got.length < ROWS) break;
  }
  return rows;
}

async function applyhomeAll(fetchJson, key, op) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const u = new URL(`${APPLYHOME}/${op}`);
    u.searchParams.set("serviceKey", key);
    u.searchParams.set("page", String(page));
    u.searchParams.set("perPage", String(ROWS));
    u.searchParams.set("cond[SUBSCRPT_AREA_CODE_NM::EQ]", "전북");
    const json = await fetchJson(u.toString());
    // data 배열이 없으면 오류 응답이다 — 조용히 0건이 되지 않게 던진다(리뷰 I-3)
    if (!Array.isArray(json?.data)) throw new Error(`applyhome ${op}: data 없음`);
    const got = json.data;
    rows.push(...got);
    if (got.length < ROWS || rows.length >= Number(json?.totalCount ?? 0)) break;
  }
  return rows;
}

/** 네 목록을 모두 받아 합친다. 하나라도 실패하면 던진다(부르는 쪽이 지난 스냅숏을 지킨다). */
export async function collectNotices({ fetchJson, key, today }) {
  const [rent, sale, apt, remain] = await Promise.all([
    myhomeAll(fetchJson, key, "rsdtRcritNtcList"),
    myhomeAll(fetchJson, key, "ltRsdtRcritNtcList"),
    applyhomeAll(fetchJson, key, "getAPTLttotPblancDetail"),
    applyhomeAll(fetchJson, key, "getRemndrLttotPblancDetail"),
  ]);
  return mergeNotices(
    [
      ...rent.map((r) => fromMyhome(r, "공공임대")),
      ...sale.map((r) => fromMyhome(r, "공공분양")),
      ...apt.map((r) => fromApplyhome(r, "아파트 분양")),
      ...remain.map((r) => fromApplyhome(r, "무순위 · 잔여")),
    ],
    today
  );
}
