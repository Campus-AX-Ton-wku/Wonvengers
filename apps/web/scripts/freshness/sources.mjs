/**
 * 각 소스의 레코드를 대조 가능한 하나의 모양으로 정규화한다.
 *
 *   { name, applicationStart, applicationEnd, ageMin, ageMax }
 *
 * **말할 수 없는 값은 null 로 둔다.** 이게 이 모듈의 유일한 규칙이다.
 * 보조금24 의 신청기한은 "2026년 상반기"·"상시신청"·"예산소진시까지" 처럼
 * 날짜가 아니다. 이걸 날짜로 우겨 넣으면 앱의 맞는 값(3/30~5/29)을 틀린
 * 값으로 덮어쓴다 — 2026-08-30 spike 에서 실제로 확인한 사례다.
 * null 로 두면 compareField 가 '대조불가'로 처리하고 사람에게 넘긴다.
 */

const 빈값 = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/**
 * 소스가 이 등록을 마지막으로 손본 날. "2025-01-16 20:21:20" 도
 * "20260810153819" 도 앞 8자리가 날짜다.
 */
function 갱신일(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** "20260415 ~ 20260930" → { start, end }. 종료일이 없으면 end 는 null(상시). */
export function parseYouthPeriod(raw) {
  const dates = String(raw ?? "").match(/\d{8}/g);
  if (!dates?.length) return { start: null, end: null };
  const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return { start: iso(dates[0]), end: dates[1] ? iso(dates[1]) : null };
}

export function fromYouth(record) {
  const { start, end } = parseYouthPeriod(record.aplyYmd);
  // sprtTrgtAgeLmtYn === "Y" 는 나이 제한 없음이다. 0~0 으로 두면 앱의
  // 19~34 와 대조되어 매주 거짓 불일치가 뜬다.
  const 나이제한없음 = record.sprtTrgtAgeLmtYn === "Y";
  const 나이 = (v) => {
    if (나이제한없음) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    name: 빈값(record.plcyNm),
    applicationStart: start,
    applicationEnd: end,
    ageMin: 나이(record.sprtTrgtMinAge),
    ageMax: 나이(record.sprtTrgtMaxAge),
    updatedAt: 갱신일(record.lastMdfcnDt),
  };
}

export function fromGov24(record) {
  return {
    name: 빈값(record["서비스명"]),
    // 신청기한·지원대상은 자유 서술이라 날짜·나이를 말할 수 없다. 위 주석 참고.
    applicationStart: null,
    applicationEnd: null,
    ageMin: null,
    ageMax: null,
    updatedAt: 갱신일(record["수정일시"]),
  };
}
