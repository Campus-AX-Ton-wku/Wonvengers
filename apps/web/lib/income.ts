import thresholds from "@/data/income-thresholds.json";

const table = thresholds.monthlyMedianIncomeByHouseholdSize as Record<string, number>;
const sizes = Object.keys(table).map(Number).sort((a, b) => a - b);
const maxSize = sizes[sizes.length - 1];
const stepFromLastTwo = table[String(maxSize)] - table[String(maxSize - 1)];

/** 가구원 수에 해당하는 월 기준 중위소득(100%)을 반환한다. 표를 벗어나면 마지막 두 구간 차액만큼 외삽한다. */
export function medianIncomeFor(householdSize: number): number {
  const size = Math.max(1, Math.round(householdSize));
  if (size <= maxSize) return table[String(size)];
  return table[String(maxSize)] + stepFromLastTwo * (size - maxSize);
}

/** 가구원 수와 퍼센트로 소득 상한액을 계산한다 (예: 60% => 0.6). */
export function medianIncomeCeiling(householdSize: number, percent: number): number {
  return Math.round(medianIncomeFor(householdSize) * percent);
}

export const INCOME_EFFECTIVE_YEAR = thresholds.effectiveYear;
