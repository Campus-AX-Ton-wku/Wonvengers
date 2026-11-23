/**
 * 3D 아이콘 이름과 고르는 규칙 (2026-11-18 디자인 시안 '3D 아이콘 설계').
 * 그림은 public/icons3d/<이름>.webp — 256px 정사각 · 투명 배경 · 긴 변이 칸의 89% · 가운데.
 * 그리는 곳은 app/components/Icon3D.tsx 하나다.
 *
 * 세 가지 그림의 역할 — 섞여도 헷갈리지 않게 할 일을 나눈다
 *   3D 아이콘   무엇에 관한 것인지 — 정책 종류 · 선택지의 주제 · 서류 종류
 *   선 아이콘   무엇을 할 수 있는지 — 버튼 · 상단바 · 상태 배지 · 화살표 (lucide, app/components/icons.tsx)
 *   Perky       지금 어떤 상태인지 — 한 화면에 한 포즈
 * 그래서 버튼 안 · 상단바 · 배지 · 금액 옆 · Perky 가 있는 자리 · 32px 보다 작은 자리에는 3D 를 두지 않는다.
 */

/**
 * 정책 종류 9개. Supabase policies.icon(enum public.policy_icon)이 고를 수 있는 이름과 같다 —
 * scripts/app-data/from-db.mjs 의 POLICY_ICONS 와 같은지 테스트가 확인한다.
 */
export const POLICY_ICONS = [
  "rent", // 월세 지원
  "moving", // 이사비 · 중개보수
  "move-in", // 전입 지원
  "housing-benefit", // 주거급여
  "guarantee", // 보증료 지원
  "student", // 학생 지원 (현재 상태 '대학생' 선택지와 같은 그림)
  "settle", // 정착 지원
  "loan", // 대출 · 이자 지원
  "bankbook", // 청약 · 저축 (서류 '통장 사본'과 같은 그림)
] as const;
export type PolicyIcon = (typeof POLICY_ICONS)[number];

export const ICON3D_NAMES = [
  ...POLICY_ICONS,
  // 첫 질문의 선택지 — 현재 상태 · 주거 형태
  "work",
  "job-seek",
  "monthly",
  "yearly",
  "jeonse",
  "other",
  // 서류 — 맞는 그림이 없는 서류(신청서 · 동의서 · 위임장 …)는 form
  "contract",
  "resident",
  "id-card",
  "form",
  // 안내 칸
  "calculator",
  // 시안 3번 '결과 화면 섹션 머리'(계산 내역 · 목돈)용. 11/18 결과 화면이 영수증 한 장으로 합쳐지며 그 자리가
  // '금액 옆 · 결과 요약'(넣지 않는 자리) 안으로 들어가 지금은 쓰는 곳이 없다 — 그림은 남겨 둔다(11/20 결정)
  "receipt",
  "wallet",
] as const;
export type Icon3DName = (typeof ICON3D_NAMES)[number];

/** 시안의 크기 — 26 홈 인사 프로필 그림(11/22) · 32 서류 줄 · 36 선택지 · 40 카드 · 섹션 · 48 안내 칸 · 64 타일 · 프로필 카드 */
export type Icon3DSize = 26 | 32 | 36 | 40 | 48 | 64;

/**
 * 서류 이름 → 그림. 팀이 공고 원문 그대로 적은 이름(policies.documents)이라 낱말로 맞춘다.
 * 순서가 중요하다 — '위임받는 사람 신분증'은 신분증, '임대차 계약서'는 계약서. 나머지는 모두 서식(form).
 * 신분증 이름을 등본보다 먼저 잡는다 — '주민등록증'은 '주민등록'이 들어 있지만 등본이 아니라 신분증이다(11/20 교차검증).
 * 서류 줄마다 그림이 있어야 목록이 들쭉날쭉하지 않다.
 */
export function documentIcon(name: string): Icon3DName {
  if (/신분증|주민등록증|운전면허증|여권/.test(name)) return "id-card";
  if (name.includes("통장")) return "bankbook";
  if (/주민등록|등본|초본/.test(name)) return "resident";
  if (name.includes("계약서")) return "contract";
  return "form";
}
