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

const won = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
/** 세대 수 — 0 은 그대로, 빈 값 · "null" 은 null(0 으로 만들지 않는다 — F0-5) */
const count = (v) => (v === null || v === undefined || String(v).trim() === "" || !(Number(v) >= 0) ? null : Number(v));
const range = (label, s, e) => {
  const start = ymd(s);
  if (!start) return null;
  const end = ymd(e);
  return { label, start, end: end && end !== start ? end : null };
};

/** "0638581118" → "063-858-1118". 모르는 모양은 null — 틀린 번호를 걸게 하지 않는다 */
export function telLabel(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  const m = /^(02)(\d{3,4})(\d{4})$/.exec(d) ?? /^(0\d{2})(\d{3,4})(\d{4})$/.exec(d) ?? /^(1\d{3})(\d{4})$/.exec(d);
  return m ? m.slice(1).join("-") : null;
}

// 마이홈 금액은 원, 모두 '최소'(가장 낮은 조건) — 11/23 LH 공고문 PDF 와 대조 (설계 §7.0)
const RENT = [["임대보증금", "rentGtn"], ["월 임대료", "mtRntchrg"]];
const SALE = [["계약금", "enty"], ["중도금", "prtpay"], ["잔금", "surlus"]];

function myhomeDetail(row, kind) {
  const refrnc = text(row.refrnc);
  return {
    schedule: [range("모집 공고", row.rcritPblancDe), range("접수", row.beginDe, row.endDe), range("당첨자 발표", row.przwnerPresnatnDe)].filter(Boolean),
    facts: [],
    complexes: [
      {
        name: text(row.hsmpNm) ?? text(row.pblancNm),
        address: text(row.fullAdres),
        households: won(row.sumSuplyCo),
        heating: text(row.heatMthdNm),
        amounts: (kind === "공공임대" ? RENT : SALE).map(([label, k]) => ({ label, won: won(row[k]) })).filter((a) => a.won !== null),
      },
    ],
    houseTypes: null,
    contact: refrnc ? { department: refrnc, phone: refrnc.match(/(?<!\d)(?:\d{2,4}-\d{3,4}-\d{4}|1\d{3}-\d{4})(?!\d)/)?.[0] ?? null, url: null } : null,
  };
}

function applyhomeDetail(row) {
  const rank = (n) => {
    const here = range(`${n}순위 해당지역`, row[`GNRL_RNK${n}_CRSPAREA_RCPTDE`], row[`GNRL_RNK${n}_CRSPAREA_ENDDE`]);
    const etc = range(`${n}순위 기타지역`, row[`GNRL_RNK${n}_ETC_AREA_RCPTDE`], row[`GNRL_RNK${n}_ETC_AREA_ENDDE`]);
    return here && etc && here.start === etc.start && here.end === etc.end ? [{ ...here, label: `${n}순위` }] : [here, etc];
  };
  const ranks = [...rank(1), ...rank(2)].filter(Boolean);
  const ym = /^(\d{4})(\d{2})$/.exec(String(row.MVN_PREARNGE_YM ?? "").trim());
  const phone = telLabel(row.MDHS_TELNO);
  const homepage = link(row.HMPG_ADRES);
  return {
    schedule: [
      range("모집 공고", row.RCRIT_PBLANC_DE),
      range("특별공급", row.SPSPLY_RCEPT_BGNDE, row.SPSPLY_RCEPT_ENDDE),
      // 순위별 날짜가 없으면(무순위 · 잔여 등) 접수 한 줄
      ...(ranks.length ? ranks : [range("접수", row.SUBSCRPT_RCEPT_BGNDE ?? row.RCEPT_BGNDE, row.SUBSCRPT_RCEPT_ENDDE ?? row.RCEPT_ENDDE)]),
      range("당첨자 발표", row.PRZWNER_PRESNATN_DE),
      range("계약", row.CNTRCT_CNCLS_BGNDE, row.CNTRCT_CNCLS_ENDDE),
    ].filter(Boolean),
    facts: [
      won(row.TOT_SUPLY_HSHLDCO) && { label: "공급 규모", value: `${won(row.TOT_SUPLY_HSHLDCO)}세대` },
      ym && { label: "입주 예정", value: `${ym[1]}년 ${Number(ym[2])}월` },
      text(row.CNSTRCT_ENTRPS_NM) && { label: "시공", value: text(row.CNSTRCT_ENTRPS_NM) },
    ].filter(Boolean),
    complexes: [],
    houseTypes: null,
    contact: phone || homepage ? { department: "견본주택", phone, url: homepage } : null,
  };
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
    detail: myhomeDetail(row, kind),
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
    detail: applyhomeDetail(row),
  };
}

/** 같은 공고는 한 번(마이홈 단지 줄은 단지로 모은다), 정정공고가 대신한 공고 · 끝난 공고 · 기간이 없는 공고는 뺀다 */
export function mergeNotices(list, today) {
  const replaced = new Set(list.map((n) => n?.replaces).filter(Boolean));
  const kept = new Map();
  for (const n of list) {
    if (!n || replaced.has(n.id)) continue;
    if (!n.applyStart && !n.applyEnd) continue;
    if (n.applyEnd && n.applyEnd < today) continue;
    const first = kept.get(n.id);
    if (first) {
      // 마이홈은 단지마다 한 줄 — 단지를 모은다(설계 §7.2)
      for (const c of n.detail?.complexes ?? [])
        if (!first.detail.complexes.some((x) => x.name === c.name && x.address === c.address)) first.detail.complexes.push(c);
      continue;
    }
    const { replaces: _replaces, ...notice } = n;
    kept.set(n.id, notice);
  }
  return [...kept.values()];
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

/** 청약홈 주택형 — LTTOT_TOP_AMOUNT 는 만원(11/23 청약홈 화면과 대조) → 원 */
export function fromApplyhomeModels(json) {
  if (!Array.isArray(json?.data)) throw new Error("applyhome mdl: data 없음");
  return [...json.data]
    .sort((a, b) => String(a.MODEL_NO).localeCompare(String(b.MODEL_NO)))
    .map((r) => {
      const m = /^(\d+(?:\.\d+)?)\s*([A-Z]*)/.exec(String(r.HOUSE_TY ?? "").trim());
      const price = won(r.LTTOT_TOP_AMOUNT);
      return {
        type: m ? `${Number(m[1])}㎡${m[2] ? ` ${m[2]}` : ""}` : String(r.HOUSE_TY ?? "").trim(),
        general: count(r.SUPLY_HSHLDCO),
        special: count(r.SPSPLY_HSHLDCO),
        topPrice: price === null ? null : price * 10_000,
      };
    });
}

async function applyhomeModels(fetchJson, key, id) {
  const [, manageNo, pblancNo] = /^applyhome:(.+)-(.*)$/.exec(id);
  const u = new URL(`${APPLYHOME}/getAPTLttotPblancMdl`);
  u.searchParams.set("serviceKey", key);
  u.searchParams.set("page", "1");
  u.searchParams.set("perPage", String(ROWS)); // 한 단지 주택형은 100개를 넘지 않는다. totalCount 는 전체 표 수라 쓰지 않는다
  u.searchParams.set("cond[HOUSE_MANAGE_NO::EQ]", manageNo);
  u.searchParams.set("cond[PBLANC_NO::EQ]", pblancNo);
  const json = await fetchJson(u.toString());
  // 조건을 무시한 줄이 섞여도 남의 단지 금액이 이 공고 표에 들어가지 않게 (목록 API 는 지역 조건을 무시했다 — 맨 위 주석)
  const rows = Array.isArray(json?.data) ? json.data.filter((r) => String(r.HOUSE_MANAGE_NO) === manageNo && String(r.PBLANC_NO) === pblancNo) : json?.data;
  return fromApplyhomeModels({ ...json, data: rows });
}

/** 네 목록을 모두 받아 합친다. 하나라도 실패하면 던진다(부르는 쪽이 지난 스냅숏을 지킨다). */
export async function collectNotices({ fetchJson, key, today }) {
  const [rent, sale, apt, remain] = await Promise.all([
    myhomeAll(fetchJson, key, "rsdtRcritNtcList"),
    myhomeAll(fetchJson, key, "ltRsdtRcritNtcList"),
    applyhomeAll(fetchJson, key, "getAPTLttotPblancDetail"),
    applyhomeAll(fetchJson, key, "getRemndrLttotPblancDetail"),
  ]);
  const notices = mergeNotices(
    [
      ...rent.map((r) => fromMyhome(r, "공공임대")),
      ...sale.map((r) => fromMyhome(r, "공공분양")),
      ...apt.map((r) => fromApplyhome(r, "아파트 분양")),
      ...remain.map((r) => fromApplyhome(r, "무순위 · 잔여")),
    ],
    today
  );
  // 주택형은 남은 아파트 공고만, 실패하면 그 공고의 표만 빠진다(설계 §7.2). 무순위는 단위 미대조라 부르지 않는다
  await Promise.all(
    notices
      .filter((n) => n.kind === "아파트 분양")
      .map(async (n) => {
        try {
          n.detail.houseTypes = await applyhomeModels(fetchJson, key, n.id);
        } catch {
          n.detail.houseTypes = null;
        }
      })
  );
  return notices;
}
