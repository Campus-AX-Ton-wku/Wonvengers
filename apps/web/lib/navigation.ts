import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isEntryPage, moveEntryOnReplace } from "./entry";

/**
 * 단계 주소와 뒤로가기 (docs/기획/2026-11-03-단계-이동-설계.md "이동 규칙").
 *
 * 질문 단계를 컴포넌트 상태가 아니라 주소(?q= / ?s= / ?g=)에 둔다. 그래야 "다음" 이
 * 브라우저 기록을 하나씩 쌓고, 휴대폰 뒤로가기가 이전 질문으로 간다. 상태에만 두면 기록에
 * 남지 않아 뒤로가기가 앱 밖으로 나간다.
 *
 * useStepParam 은 useSearchParams 를 쓴다. 정적 export 에서는 이 훅을 쓰는 화면의 본문을
 * <Suspense> 안에 둬야 빌드가 된다.
 */

/** 주소 값을 단계로 읽는다. 없거나, 모르는 값이거나, 앞 단계를 건너뛴 주소면 첫 미답 단계로 돌린다. */
export function resolveStep<K extends string>(
  raw: string | null,
  keys: readonly K[],
  firstUnanswered: K,
  isReachable: (k: K) => boolean
): { step: K; redirect: boolean } {
  const known = keys.find((k) => k === raw);
  if (known !== undefined && isReachable(known)) return { step: known, redirect: false };
  return { step: firstUnanswered, redirect: true };
}

/** 단계 주소. 다른 쿼리는 버리고, 그 단계에 필요한 값만 extra 로 다시 붙인다. */
export function stepHref(
  pathname: string,
  param: string,
  step: string,
  extra: Record<string, string> = {}
): string {
  return `${pathname}?${new URLSearchParams({ [param]: step, ...extra }).toString()}`;
}

/** replace 하면서 "이 탭의 첫 화면" 기록도 따라 옮긴다 (lib/entry.ts 의 moveEntryOnReplace). */
export function replaceKeepingEntry(router: { replace(href: string): void }, href: string): void {
  moveEntryOnReplace(href);
  router.replace(href);
}

export interface StepNavigation<K extends string> {
  /** 지금 단계. 주소에서 읽는다. */
  step: K;
  /** 단계 말고 주소에 있는 값 (예: /find 지역 질문의 p=<시도명>). */
  query(name: string): string | null;
  /** 다른 단계로 간다. 기록이 하나 쌓인다. */
  go(step: K, extra?: Record<string, string>): void;
}

export function useStepParam<K extends string>(
  param: string,
  keys: readonly K[],
  opts: {
    /** 저장된 답을 다 불러왔는가. 그 전에는 주소를 고치지 않는다 — 빈 답으로 판정하면 늘 첫 단계로 튕긴다. */
    ready: boolean;
    /** 주소에 단계가 없거나 갈 수 없는 단계일 때 보낼 곳. */
    firstUnanswered: K;
    /** 이 단계 앞의 답이 다 있는가. */
    isReachable(k: K): boolean;
  }
): StepNavigation<K> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get(param);

  const { step, redirect } = opts.ready
    ? resolveStep(raw, keys, opts.firstUnanswered, opts.isReachable)
    : { step: keys.find((k) => k === raw) ?? opts.firstUnanswered, redirect: false };
  const target = stepHref(pathname, param, step);

  useEffect(() => {
    // replace — 기록을 늘리지 않는다. 주소에 단계가 없던 화면이 그대로 그 단계 화면이 된다.
    if (redirect) replaceKeepingEntry(router, target);
  }, [redirect, target, router]);

  const go = useCallback(
    (next: K, extra?: Record<string, string>) => router.push(stepHref(pathname, param, next, extra)),
    [router, pathname, param]
  );
  const query = useCallback((name: string) => searchParams.get(name), [searchParams]);

  return { step, query, go };
}

/**
 * 왼쪽 위 화살표 = 휴대폰 뒤로가기.
 *
 * 앞 화면이 이 앱 안이면 history.back(). 이 탭의 첫 화면이면 backHref 로 replace 하고 그
 * 자리를 새 첫 화면으로 삼는다. push 로 가면 backHref 화면의 화살표가 다시 history.back()
 * 으로 방금 떠난 화면에 돌아가 두 화면 사이를 오간다.
 */
export function useBack(backHref: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (isEntryPage()) replaceKeepingEntry(router, backHref);
    else window.history.back();
  }, [router, backHref]);
}
