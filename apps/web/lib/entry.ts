/**
 * 이 탭의 첫 화면. 왼쪽 위 화살표가 "뒤로" 갈지 "정해 둔 상위 화면" 으로 갈지 가르는 기준이다
 * (docs/기획/2026-11-03-단계-이동-설계.md "왼쪽 위 화살표 = 뒤로가기").
 *
 * 주소가 아니라 브라우저 기록의 "칸" 으로 가린다. 첫 화면 칸의 history.state 에 표(ENTRY_STATE)
 * 를 달고, 그 표의 값을 sessionStorage(ENTRY_KEY)에 둔다. 지금 칸의 표가 그 값과 같으면 첫 화면.
 *
 * 주소로 가리면 안 되는 이유: 첫 화면이 /find?q=birth 일 때 요약 줄의 "만 N세" 를 누르면 같은
 * 주소가 새 칸으로 push 된다. 주소로는 그 칸도 첫 화면이라, 화살표가 앞 질문(?q=status)이 아니라
 * 랜딩으로 replace 했다. 새 칸에는 표가 없으니 이제는 history.back() 한다.
 *
 * 표가 살아남는 경우 (2026-11-03, Next 15.5 정적 export 를 Playwright 로 확인 —
 * .superpowers/sdd/2026-11-03-단계-이동-구현계획/final-fix-report.md):
 * - 하이드레이션, 새로고침, 뒤로·앞으로(popstate): Next 가 기존 state 를 펼쳐 넣는다.
 * - router.push: 새 칸이라 표가 없다 — 바라는 대로다.
 * - router.replace: Next 가 state 를 새로 써서 표가 지워진다. 그래서 replaceCarryingEntry 가
 *   Next 의 replace 가 반영된 뒤 같은 표를 다시 단다.
 *
 * 이 파일은 React 를 import 하지 않는다. 서버 컴포넌트인 app/layout.tsx 가 ENTRY_SCRIPT 를
 * 가져가는데, 같은 파일에 훅 import 가 있으면 Next 가 서버 그래프에서 막는다.
 */

/** 표의 값. 탭마다 하나. 예전 키(perky.entry)는 주소를 담았으므로 이름을 바꿨다. */
export const ENTRY_KEY = "perky.entryTag";
/** history.state 안의 표 이름. */
export const ENTRY_STATE = "perkyEntry";

/** "/" 에서 /onboarding 으로 location.replace 하는 중이고, 그 칸이 첫 화면이었다는 표시. */
export const ENTRY_REDIRECT_KEY = `${ENTRY_KEY}.redirect`;

/**
 * <head> 인라인 스크립트. 전체 로드 때마다 React 보다 먼저 돈다.
 *
 * - 값이 이미 있으면 표를 새로 달지 않는다. 새로고침해도 칸의 state 가 남아 판정이 유지된다.
 * - "/" 에서는 안 단다. 바로 앞의 ONBOARDING_REDIRECT 가 /onboarding 으로 location.replace
 *   하고, 그 로드에서 단다. location.replace 는 같은 칸을 쓰지만 state 를 비운다. 그래서
 *   "/" 가 첫 화면 칸이었으면(화살표로 랜딩에 온 뒤 새로고침) 표시를 남겨 /onboarding 로드가
 *   같은 표를 다시 달게 한다.
 * - 저장소가 막혀 있으면 조용히 넘어간다. isEntryPage 가 그 경우를 첫 화면으로 본다.
 * - 이 시점의 history.replaceState 는 Next 가 감싸기 전 원본이다. 하이드레이션 때 Next 가
 *   기존 state 를 펼쳐 넣으므로 표가 남는다.
 */
export const ENTRY_SCRIPT = [
  "try{",
  `var s=sessionStorage,h=history.state,t=s.getItem("${ENTRY_KEY}");`,
  'if(location.pathname==="/"){',
  `if(t&&h&&h.${ENTRY_STATE}===t)s.setItem("${ENTRY_REDIRECT_KEY}","1")`,
  `}else if(!t||s.getItem("${ENTRY_REDIRECT_KEY}")){`,
  `t=t||Math.random().toString(36).slice(2)+Date.now().toString(36);`,
  `s.setItem("${ENTRY_KEY}",t);s.removeItem("${ENTRY_REDIRECT_KEY}");`,
  `history.replaceState(Object.assign({},h,{${ENTRY_STATE}:t}),"")`,
  "}}catch(e){}",
].join("");

function newTag(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function currentTag(): unknown {
  const state: unknown = window.history.state;
  return state !== null && typeof state === "object" ? (state as Record<string, unknown>)[ENTRY_STATE] : undefined;
}

function tagCurrentEntry(tag: string): void {
  const state: unknown = window.history.state;
  const base = state !== null && typeof state === "object" ? state : {};
  window.history.replaceState({ ...base, [ENTRY_STATE]: tag }, "");
}

/** 기록과 비교하는 형태의 지금 주소. 경로 + 쿼리(브라우저가 인코딩한 그대로). */
export function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

/** 첫 화면 칸을 replace 하는 중 — Next 가 아직 반영하지 않아 표가 잠시 없다. */
let carrying: {
  tag: string;
  target: string;
  before: unknown;
  beforeUrl: string;
  deadline: number;
  timer: ReturnType<typeof setTimeout> | null;
} | null = null;

/** replace 가 반영되기를 기다리는 한도. 넘으면 포기한다 (그 사이 다른 곳으로 갔다). */
const CARRY_TIMEOUT_MS = 10_000;
const CARRY_POLL_MS = 16;

/**
 * 지금 화면이 이 탭의 첫 화면인가.
 *
 * 기록이 없거나, 저장소가 막혀 있거나, 탭에 기록이 한 칸뿐이면 첫 화면으로 본다.
 * history.back() 으로 앱 밖에 튕기거나 아무 데도 못 가는 것보다 정해 둔 상위 화면으로 가는
 * 편이 안전하다. 한 칸뿐인 경우: 새 탭으로 열려 sessionStorage 만 복사돼 온 경우다.
 */
export function isEntryPage(): boolean {
  if (carrying !== null) return true;
  try {
    if (window.history.length <= 1) return true;
    const tag = window.sessionStorage.getItem(ENTRY_KEY);
    return tag === null || currentTag() === tag;
  } catch {
    return true;
  }
}

function stopCarrying(): void {
  if (carrying?.timer != null) clearTimeout(carrying.timer);
  carrying = null;
}

function tick(): void {
  const c = carrying;
  if (c === null) return;
  // 주소가 목적지가 됐고, 주소나 state 가 replace 전과 달라졌으면 Next 가 반영한 것이다.
  // 같은 주소로 replace 하면 주소로는 알 수 없어 state 가 새것으로 바뀌기를 기다린다.
  if (currentUrl() === c.target && (c.target !== c.beforeUrl || window.history.state !== c.before)) {
    tagCurrentEntry(c.tag);
    stopCarrying();
    return;
  }
  if (Date.now() > c.deadline) {
    stopCarrying();
    return;
  }
  c.timer = setTimeout(tick, CARRY_POLL_MS);
}

/**
 * replace 는 칸을 늘리지 않는다. 첫 화면 칸에서 replace 하면 바뀐 화면도 여전히 첫 화면이라
 * 표를 다시 단다. 안 달면 /find → /find?q=birth 로 바뀐 순간 첫 화면을 잃고, 첫 질문의
 * 화살표가 history.back() 으로 앱 밖에 나간다.
 *
 * replace 는 바로 하고, 표는 replace 가 반영된 뒤 단다. 그 사이에는 isEntryPage 가 첫 화면으로
 * 본다(/onboarding → /find → /find?q=birth 처럼 replace 가 연달아 오는 경우).
 */
export function replaceCarryingEntry(href: string, replace: () => void): void {
  let tag: string | null = null;
  if (isEntryPage()) {
    tag = carrying?.tag ?? null;
    if (tag === null) {
      try {
        tag = window.sessionStorage.getItem(ENTRY_KEY);
        if (tag === null) {
          tag = newTag();
          window.sessionStorage.setItem(ENTRY_KEY, tag);
        }
      } catch {
        // 저장소가 막혀 있으면 isEntryPage 가 늘 첫 화면으로 본다. 달 것이 없다.
        tag = null;
      }
    }
  }
  stopCarrying();
  const before: unknown = window.history.state;
  const beforeUrl = currentUrl();
  replace();
  if (tag === null) return;
  const url = new URL(href, window.location.href);
  carrying = { tag, target: url.pathname + url.search, before, beforeUrl, deadline: Date.now() + CARRY_TIMEOUT_MS, timer: null };
  tick();
}
