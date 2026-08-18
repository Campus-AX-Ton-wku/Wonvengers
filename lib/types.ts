// 1층 질문 4개에 대한 사용자 답변. null 은 사용자가 `모름`을 선택했다는 뜻이다.
export type Region = "익산시" | "전라북도 (익산 외)" | "그 외 지역";
export type Status = "대학생" | "재직" | "구직";

export type Answers = {
  age: number | null;
  region: Region | null;
  status: Status | null;
  incomeBracket: number | null;
};

// 1층 태그 판정에 쓰는 유일한 필드 묶음.
export type PolicyFilter = {
  age_min: number;
  age_max: number;
  regions: string[]; // "익산시" | "전라북도" | "전국"
  statuses: Status[];
  income_bracket_max: number;
};

export type Policy = {
  id: string;
  tier: 1 | 2;
  name: string;
  agency: string;
  filter: PolicyFilter;
  extra_conditions: string[];
  benefit_summary: string;
  benefit_type: string;
  application_start: string; // YYYY-MM-DD
  application_end: string; // YYYY-MM-DD
  source_url: string;
  apply_url: string;
  verified_at: string; // YYYY-MM-DD
  verified_by: string;
  effective_year: number;

  // 아래는 tier 2(정밀 계산) 에서만 쓴다. 1층 코드는 읽지 않는다.
  required_inputs?: string[];
  eligibility_rules?: Record<string, unknown>;
  exception_rules?: Record<string, unknown>;
  benefit_formula?: Record<string, unknown>;
  payment_schedule?: Record<string, unknown>;
  exclusive_group?: string;
  notes?: string;
};

export type Tag = "가능성 있음" | "확인 필요" | "해당 없음";

export type TagResult = {
  tag: Tag;
  failReasons: string[]; // `해당 없음`일 때 모든 탈락 이유
  unknownFields: string[]; // `확인 필요`일 때 `모름`으로 답한 항목 이름
};

export type IncomeBracket = {
  bracket: number;
  label: string;
};
