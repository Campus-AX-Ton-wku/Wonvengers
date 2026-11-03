import { Check, ICON_SM } from "./icons";

/**
 * 앞 화면(1층)의 답을 그대로 옮겨 왔다는 표시. 색만으로 말하지 않도록 체크를 붙인다.
 *
 * /calculate(지역·계약 형태)와 /eligibility(현재 상태)가 같은 말투·모양을 쓴다.
 * 화면마다 따로 두면 "이건 내가 답한 것" 이라는 신호가 화면마다 달라 보인다.
 */
export function CarriedOver({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
      <Check size={ICON_SM - 2} strokeWidth={3} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}
