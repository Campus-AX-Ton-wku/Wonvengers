/**
 * 앱 · 온통청년 · 보조금24 3자 대조.
 *
 * 값을 말할 수 있는 소스만 센다. 어떤 소스는 어떤 필드를 아예 모른다 —
 * 보조금24 는 신청기한이 "2026년 상반기" 처럼 날짜가 아닌 문자열이라
 * 종료일을 말하지 못한다. 모르는 소스를 "불일치"로 세면 안 된다.
 */

/**
 * 정책명 대조용 정규화. 앱은 이름에 팀 주석을 단다 —
 * "청년월세 지원 (2026년 상시사업 전환)" 대 온통청년의 "청년월세 지원".
 * 괄호와 공백만 걷어낸다. 그 이상 뭉개면 "파주시 청년월세 지원" 같은
 * 다른 지자체 사업까지 같다고 말하게 된다.
 */
export function normalizeName(name) {
  return String(name ?? "")
    .replace(/[(（][^)）]*[)）]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** 소스별 값에서 말할 수 있는 것만 남긴다. */
function statingSources({ app, youth, gov24 }) {
  return Object.entries({ 앱: app, 온통청년: youth, 보조금24: gov24 }).filter(
    ([, value]) => value !== null && value !== undefined
  );
}

export function compareField({ field, app, youth, gov24, normalize }) {
  // 표기 차이를 걸러내되, 보고에는 원문을 그대로 싣는다. 사람이 판단하려면
  // 정규화된 값이 아니라 소스가 실제로 뭐라고 적었는지를 봐야 한다.
  const key = normalize ?? ((v) => v);
  const stating = statingSources({ app, youth, gov24 });
  const 바깥 = stating.filter(([name]) => name !== "앱");
  const base = { field, app, youth, gov24 };

  // 바깥이 아무 말도 못 하면 대조가 성립하지 않는다. 이걸 "일치"로 세면
  // 아무도 확인하지 않은 값이 확인된 값처럼 보인다.
  if (바깥.length === 0) {
    return { ...base, verdict: "대조불가", needsReview: false, priority: null, detail: "바깥 소스에 이 값이 없다" };
  }

  const values = new Set(stating.map(([, value]) => key(value)));
  if (values.size <= 1) {
    return { ...base, verdict: "일치", needsReview: false, priority: null, detail: null };
  }

  // 앱이 혼자 튀는지, 바깥이 튀는지가 우선순위를 가른다.
  const 동의 = 바깥.filter(([, value]) => key(value) === key(app)).map(([name]) => name);
  const 이견 = 바깥.filter(([, value]) => key(value) !== key(app));

  const 이견이름 = 이견.map(([name]) => name);

  if (동의.length > 0) {
    // 앱을 뒷받침하는 소스가 있다. 바깥 등록이 낡은 흔한 경우다.
    return {
      ...base,
      verdict: "불일치",
      needsReview: true,
      priority: "낮음",
      detail: `${이견이름.join("·")}만 다름 (앱과 ${동의.join("·")} 은 "${app}" 로 일치)`,
    };
  }

  // 앱을 뒷받침하는 소스가 없다. 바깥끼리 서로 같을 때만 "서로 일치"라고 말한다 —
  // 셋 다 다른 경우까지 합의로 적으면 없는 근거를 지어내는 것이다.
  const 바깥합의 = new Set(이견.map(([, value]) => key(value))).size === 1 && 이견.length > 1;

  return {
    ...base,
    verdict: "불일치",
    needsReview: true,
    priority: "높음",
    detail: 바깥합의
      ? `앱만 다름 (${이견이름.join("·")} 은 "${이견[0][1]}" 로 같다)`
      : `${["앱", ...이견이름].join("·")} 이 제각각 — 공고 원문을 봐야 한다`,
  };
}
