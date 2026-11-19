/**
 * 앱에 실린 바깥 링크가 살아 있는지 본다 (주간 신선도 검사의 5번).
 *
 * 2026-11-19: 익산 전입 지원 2건의 신청 주소가 404 였다. 공고 내용은 그대로라 1~4번 검사로는 못 잡았다.
 *
 * 판정은 둘로만 가른다. 404 · 410 만 '깨진 링크'다. 연결 실패 · 403 · 5xx 는 '열지 못함' —
 * 정부 사이트 중에 해외 서버(GitHub Actions)를 막는 곳이 있어서, 이걸 깨졌다고 하면 매주 거짓 경보가 된다.
 */
import { withRetry } from "./retry.mjs";

const FIELDS = [
  ["신청 주소", (item) => item.applyUrl],
  ["출처", (item) => item.sourceUrl],
  ["문의처", (item) => item.contact?.url],
];

/** 폰으로 여는 사람과 같게 — 데스크톱과 다른 주소로 보내는 정부 사이트가 있다. */
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** 정책 · 안내 상품에서 주소를 모은다. 같은 주소는 한 번만, 쓰인 곳은 모두. */
export function collectLinks(items) {
  const byUrl = new Map();
  for (const item of items) {
    for (const [field, pick] of FIELDS) {
      const url = pick(item);
      if (!url) continue;
      if (!byUrl.has(url)) byUrl.set(url, { url, uses: [] });
      byUrl.get(url).uses.push({ name: item.name, field });
    }
  }
  return [...byUrl.values()];
}

export async function checkLink(url, { fetch = globalThis.fetch, delayMs = 1500 } = {}) {
  try {
    const res = await withRetry(
      async () => {
        const r = await fetch(url, {
          redirect: "follow",
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(20_000),
        });
        // 본문은 읽지 않는다 — 연결을 바로 놓는다
        await r.body?.cancel?.();
        if (r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
        return r;
      },
      { attempts: 2, delayMs }
    );
    if (res.status === 404 || res.status === 410) return { url, verdict: "broken", status: res.status };
    return res.ok ? { url, verdict: "ok", status: res.status } : { url, verdict: "unreachable", status: res.status, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { url, verdict: "unreachable", status: err.status ?? null, detail: err.message };
  }
}

/** 한 번에 5개씩. 같은 기관 사이트를 몰아서 때리지 않게. */
export async function checkLinks(links, options) {
  const results = new Array(links.length);
  let next = 0;
  const worker = async () => {
    while (next < links.length) {
      const i = next++;
      results[i] = { ...links[i], ...(await checkLink(links[i].url, options)) };
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return results;
}
