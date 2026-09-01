/**
 * 화면이 쓰는 공통 컴포넌트의 단독 출처.
 *
 * 페이지는 여기서만 가져온다. 개별 파일을 직접 import 하기 시작하면 같은 버튼이
 * 화면마다 조금씩 다른 모양으로 갈라진다 — 리디자인 전이 정확히 그 상태였다.
 *
 * 여기에 없는 것은 공통이 아니다. 한 화면에서만 쓰는 조각은 그 화면 옆에 둔다
 * (예: app/find/PolicyCard.tsx). 재사용되지 않는 것을 여기로 올리지 말 것.
 */
export { AppShell, StickyBottomAction } from "./AppShell";
export { Button, LinkButton, buttonClass } from "./Button";
export type { ButtonSize, ButtonVariant } from "./Button";
export { Card } from "./Card";
export type { CardTone } from "./Card";
export { ChoiceCard } from "./ChoiceCard";
export { Disclosure } from "./Disclosure";
export { EmptyState } from "./EmptyState";
export { Field, FieldError, FieldGroup, MoneyInput, NumberInput } from "./Input";
export { IconButton, IconLink } from "./IconButton";
export { default as PerkyCharacter, PERKY_STATES } from "./PerkyCharacter";
export type { PerkyState } from "./PerkyCharacter";
export { ResultSummary } from "./ResultSummary";
export { StatusBadge } from "./StatusBadge";
export type { BadgeTone } from "./StatusBadge";
export { AnsweredStack, StepHeader } from "./StepHeader";
export type { AnsweredItem } from "./StepHeader";
export { TopBar } from "./TopBar";
export { HomeMark, Wordmark } from "./Wordmark";
