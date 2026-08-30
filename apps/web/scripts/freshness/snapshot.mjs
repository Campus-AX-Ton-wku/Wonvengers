import { createHash } from "node:crypto";

/**
 * 자유 서술 텍스트의 변경 감지.
 *
 * 보조금24 는 나이·기간을 구조화해서 주지 않는다. 파싱은 포기하고
 * "바뀌었다"는 사실만 지문으로 잡는다. 해석은 사람이 한다.
 */

/** 공백 차이는 내용 변화가 아니다. 정규화하지 않으면 편집 흔적마다 알림이 울린다. */
function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function fingerprintRecord(record) {
  const text = Object.keys(record)
    .sort()
    .map((key) => `${key}=${normalize(record[key])}`)
    .join("\n");
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * 지난 주 스냅샷과 이번 주를 비교한다.
 * 스냅샷 모양은 { [서비스ID]: { name, fingerprint } }.
 */
export function diffSnapshots(prev, next) {
  const 항목 = (id, snap) => ({ id, name: snap.name });

  const 신규 = [];
  const 변경 = [];
  for (const [id, snap] of Object.entries(next)) {
    const before = prev[id];
    if (!before) 신규.push(항목(id, snap));
    else if (before.fingerprint !== snap.fingerprint) 변경.push(항목(id, snap));
  }

  // 사라진 것도 알려야 한다. 사업이 끝났을 수도, 등록이 빠졌을 수도 있다.
  const 사라짐 = Object.entries(prev)
    .filter(([id]) => !next[id])
    .map(([id, snap]) => 항목(id, snap));

  return { 신규, 변경, 사라짐 };
}
