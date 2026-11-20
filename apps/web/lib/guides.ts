import type { Icon3DName } from "./icons3d";

/**
 * 주거 가이드 (홈 아래 카드 · /guides, 11/20).
 *
 * 청년이 처음 집을 구할 때 놓치기 쉬운 것만 짧게. 법 · 제도를 '해석'하지 않고, 공식 안내가 말하는 순서와
 * 어디서 확인하는지만 옮긴다. 금액 · 수수료 · 보증 한도처럼 자주 바뀌는 숫자는 넣지 않는다(F0-5 —
 * 확인 못 한 값은 쓰지 않는다). 대신 출처를 글마다 달고, 확인한 날을 적는다.
 * 내용을 고치면 checkedAt 을 바꾸고 sources 를 다시 열어 본다.
 */

export interface GuideSection {
  heading: string;
  items: string[];
}

export interface GuideSource {
  label: string;
  url: string;
}

export interface Guide {
  id: string;
  title: string;
  /** 홈 카드 한 줄 */
  summary: string;
  icon: Icon3DName;
  sections: GuideSection[];
  sources: GuideSource[];
  /** 출처를 마지막으로 열어 본 날 */
  checkedAt: string;
}

export const GUIDES: Guide[] = [
  {
    id: "before-contract",
    title: "계약 전에 꼭 볼 것",
    summary: "등기부등본·건축물대장 확인하기",
    icon: "contract",
    checkedAt: "2026-11-20",
    sections: [
      {
        heading: "1. 시세부터 봐요",
        items: [
          "국토교통부 실거래가 공개시스템에서 같은 동네 비슷한 집의 최근 매매가·전세가를 찾아봐요.",
          "보증금이 집값에 너무 가까우면, 나중에 집이 팔려도 보증금을 다 돌려받지 못할 수 있어요.",
        ],
      },
      {
        heading: "2. 등기부등본(등기사항증명서)",
        items: [
          "대법원 인터넷등기소에서 볼 수 있어요.",
          "갑구 — 지금 집주인(소유자)이 누구인지. 계약하는 사람과 같은 사람인지 봐요.",
          "을구 — 근저당처럼 내 보증금보다 먼저 돌려받는 권리가 있는지, 얼마인지 봐요.",
          "계약하는 날과 잔금 치르는 날, 한 번 더 떼서 바뀐 게 없는지 확인해요.",
        ],
      },
      {
        heading: "3. 건축물대장",
        items: [
          "정부24나 세움터에서 볼 수 있어요.",
          "위반건축물로 적혀 있지 않은지, 주택 용도가 맞는지 봐요. 위반건축물이면 보증보험 가입이 막힐 수 있어요.",
        ],
      },
      {
        heading: "4. 계약하는 사람",
        items: [
          "신분증을 보고 등기부의 소유자와 같은 사람인지 확인해요.",
          "대리인이 나오면 소유자의 위임장과 인감증명서를 꼭 받아요.",
          "계약금·잔금은 등기부에 적힌 소유자 이름의 계좌로 보내요.",
        ],
      },
      {
        heading: "5. 보증보험이 되는 집인지",
        items: ["계약 전에 전세보증금 반환보증에 가입할 수 있는 집인지 보증기관에 물어봐요."],
      },
    ],
    sources: [
      { label: "주택도시보증공사(HUG) 안심전세포털 — 전세사기 피해 예방", url: "https://www.khug.or.kr/jeonse/" },
      { label: "찾기쉬운 생활법령 — 주택임대차", url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=629" },
      { label: "대법원 인터넷등기소", url: "https://www.iros.go.kr" },
      { label: "세움터(건축물대장)", url: "https://www.eais.go.kr" },
      { label: "국토교통부 실거래가 공개시스템", url: "https://rt.molit.go.kr" },
    ],
  },
  {
    id: "protect-deposit",
    title: "보증금 지키는 법",
    summary: "전입신고·확정일자 바로 챙기기",
    icon: "guarantee",
    checkedAt: "2026-11-20",
    sections: [
      {
        heading: "1. 이사한 날 바로 전입신고",
        items: [
          "집에 들어가 살면서(인도) 전입신고까지 마치면, 그 다음 날 0시부터 '대항력'이 생겨요 — 집주인이 바뀌어도 계속 살 수 있는 힘이에요.",
          "효력이 다음 날부터라서, 잔금 날 근저당이 새로 잡히면 순서가 밀릴 수 있어요. 잔금 직전에 등기부를 다시 봐요.",
          "정부24에서 온라인으로, 또는 새 주소의 주민센터에서 할 수 있어요.",
        ],
      },
      {
        heading: "2. 확정일자",
        items: [
          "대항력에 확정일자까지 갖추면 '우선변제권'이 생겨요 — 집이 경매로 넘어가도 뒤 순서 채권자보다 먼저 보증금을 받는 순서예요.",
          "주민센터에서 계약서에 받거나, 대법원 인터넷등기소에서 온라인으로 받을 수 있어요.",
        ],
      },
      {
        heading: "3. 주택 임대차 신고",
        items: [
          "보증금 6천만 원이 넘거나 월세가 30만 원이 넘는 계약은 계약일부터 30일 안에 신고해야 해요(대상 지역은 국토교통부 안내 확인).",
          "신고할 때 계약서를 내면 확정일자가 따로 신청하지 않아도 무료로 붙어요.",
        ],
      },
      {
        heading: "4. 전세보증금 반환보증",
        items: [
          "계약이 끝났는데 보증금을 못 돌려받으면 보증기관이 대신 돌려주는 상품이에요.",
          "가입 기한과 조건이 있어서, 계약하고 나면 바로 가입할 수 있는지 확인해요.",
        ],
      },
      {
        heading: "5. 보증금을 못 받고 이사해야 하면",
        items: ["먼저 임차권등기를 마치고 이사해요. 그래야 주소를 옮겨도 대항력·우선변제권이 남아요."],
      },
    ],
    sources: [
      { label: "찾기쉬운 생활법령 — 주택임대차(대항력 · 우선변제권 · 임차권등기)", url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=629" },
      { label: "정책브리핑 — 주택 임대차 신고제 대상 · 방법", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148888172" },
      { label: "정책브리핑 — 임대차 신고 시 확정일자 자동 · 무료 부여", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148928316" },
      { label: "주택도시보증공사(HUG) 안심전세포털", url: "https://www.khug.or.kr/jeonse/" },
      { label: "대법원 인터넷등기소(온라인 확정일자)", url: "https://www.iros.go.kr" },
    ],
  },
  {
    id: "where-documents",
    title: "서류 떼는 곳 모음",
    summary: "정부24·주민센터에서 떼는 서류",
    icon: "resident",
    checkedAt: "2026-11-20",
    sections: [
      {
        heading: "지원금 신청에 자주 나오는 서류",
        items: [
          "주민등록등본 — 정부24(온라인), 주민센터, 무인민원발급기",
          "가족관계증명서 — 대법원 전자가족관계등록시스템, 정부24",
          "건강보험 자격득실확인서 — 국민건강보험공단 누리집·앱, 정부24",
          "소득금액증명 — 국세청 홈택스·손택스, 정부24",
          "임대차계약서 사본 — 내 계약서. 확정일자가 찍힌 면까지 함께",
          "건축물대장 — 정부24, 세움터 / 등기부등본 — 대법원 인터넷등기소",
        ],
      },
      {
        heading: "떼기 전에",
        items: [
          "제출처마다 '최근 1개월 안에 뗀 것'처럼 날짜 기준이 있어요. 미리 떼 두기보다 내기 직전에 떼요.",
          "온라인 발급은 공동·금융인증서나 간편인증이 필요해요.",
          "정부24가 점검 중이면 위 기관 누리집에서 따로 뗄 수 있어요.",
        ],
      },
    ],
    sources: [
      { label: "정부24", url: "https://www.gov.kr" },
      { label: "대법원 전자가족관계등록시스템", url: "https://efamily.scourt.go.kr" },
      { label: "국민건강보험공단", url: "https://www.nhis.or.kr" },
      { label: "국세청 홈택스", url: "https://www.hometax.go.kr" },
      { label: "세움터", url: "https://www.eais.go.kr" },
      { label: "대법원 인터넷등기소", url: "https://www.iros.go.kr" },
    ],
  },
];

export function findGuide(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
