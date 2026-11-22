import type { Icon3DName } from "./icons3d";
import type { HousingType } from "./types";

/**
 * 주거 가이드 (홈 아래 카드 · /guides, 11/20).
 *
 * 청년이 처음 집을 구할 때 놓치기 쉬운 것만 짧게. 법 · 제도를 '해석'하지 않고, 공식 안내가 말하는 순서와
 * 어디서 확인하는지만 옮긴다. 금액 · 수수료 · 보증 한도처럼 자주 바뀌는 숫자는 넣지 않는다(F0-5 —
 * 확인 못 한 값은 쓰지 않는다). 대신 출처를 글마다 단다. 확인한 날은 checkedAt 에 남긴다(화면에는 11/20 부터 적지 않는다).
 * 내용을 고치면 checkedAt 을 바꾸고 sources 를 다시 열어 본다.
 *
 * 11/20 ggue: 사회 초년생 · 대학생에게 어렵다 → 비유로 쉽게, 노션처럼 한 페이지에 한 장(/guides/[id]/[step]).
 * 비유는 설명을 돕는 데만 쓴다 — 사실은 이전 글(출처를 확인한 내용)에서만 가져왔고 새 사실 · 숫자를 더하지 않았다.
 * 정확한 용어와 뜻은 장마다 '용어 풀이'(terms)에 남긴다.
 *
 * 11/21 ggue 시안 '내용은 크게, 출처는 한 줄로': 목차 한 줄을 용어(keyword) + 제목 두 줄로 나눴다.
 * 용어가 머리말로 빠졌으니 제목은 'A = B' 대신 질문 · 권유 · 짧은 말 · 설명을 섞는다 — 같은 꼴이 셋 연달아 나오지 않게.
 * 새 제목도 그 장의 lead · body · 출처에 이미 있는 말만 썼다(30일 · 번호표 무료는 본문에 있다).
 */

export interface GuideTerm {
  term: string;
  meaning: string;
}

export interface GuideSection {
  /** 목차 · 장 윗줄에 작게 붙는 용어 (예: '등기부등본'). 아래 terms(용어 풀이)와는 다른 칸이다 */
  keyword: string;
  /** 목차 · 장 제목 — 질문 · 권유 · 짧은 말 · 설명. 비유는 여기나 본문에 남긴다 */
  title: string;
  /** 한 줄 할 일 (굵게) */
  lead: string;
  /** 짧은 문단 */
  body: string[];
  /** 어디서 해요 */
  where?: GuidePlace[];
  /** where 칸 제목 — 기본 '어디서 해요'. 서류는 '어디서 떼요', 시세는 '실거래가 공개시스템에서 봐요' */
  whereLabel?: string;
  /** true 면 '어디서' 칸 아래에 서류 떼는 곳 지도(/guides/places) 버튼 — 서류 떼는 곳 1장 */
  placesMap?: boolean;
  /** 조심해요 (있을 때만) */
  caution?: string;
  /** 용어 풀이 — 비유 대신 정확한 뜻 */
  terms?: GuideTerm[];
}

/**
 * '어디서 해요' 한 줄 (11/22 ggue — 누르면 그 일을 하는 화면으로 바로).
 * url 은 그 서비스 화면(정부24 민원 안내 · 실거래가 지도 …)을 직접 열어 제목을 확인한 주소만 쓴다. 화면을 스크립트로만 그려
 * 주소로 바로 갈 수 없는 곳(인터넷등기소)은 첫 화면. 정부24 는 plus.gov.kr 로 옮기는 중이라 /mw/ 주소가 끊길 수 있다 — 고치면 checkedAt 도.
 */
export interface GuidePlace {
  /** 기관 · 서비스 이름 */
  name: string;
  /** 바로가기 — https 공공 주소만 (lib/__tests__/guides.test.ts) */
  url?: string;
  /** 작은 글씨 덧말 — 다른 곳에서도 할 수 있으면 함께 적는다 */
  note?: string;
}

export interface GuideSource {
  /** 기관 · 누리집 이름 */
  name: string;
  /** 그 안에서 본 내용 (있을 때만, 가운뎃점은 붙여 쓴다) */
  topic?: string;
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
    summary: "집의 이력서부터 떼 봐요",
    icon: "contract",
    checkedAt: "2026-11-22",
    sections: [
      {
        keyword: "시세 확인",
        title: "이 동네 비슷한 집, 얼마에 거래됐을까?",
        lead: "같은 동네 비슷한 집이 얼마에 거래됐는지 먼저 봐요.",
        body: [
          "국토교통부 실거래가 공개시스템에서 같은 동네 비슷한 집의 최근 매매가와 전세가를 찾아볼 수 있어요.",
          "보증금이 집값에 바짝 붙어 있으면 위험해요. 나중에 집이 팔려도 그 돈으로 내 보증금을 다 돌려받지 못할 수 있거든요. 보증금과 집값 사이에 '안전거리'가 있는지 봐요.",
        ],
        where: [
          { name: "아파트", url: "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=A&mobileAt=" },
          { name: "연립·다세대", url: "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=B&mobileAt=" },
          { name: "단독·다가구", url: "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=C&mobileAt=" },
          { name: "오피스텔", url: "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=D&mobileAt=" },
        ],
        whereLabel: "실거래가 공개시스템에서 봐요",
      },
      {
        keyword: "등기부등본",
        title: "집의 이력서부터 떼 봐요",
        lead: "이 집의 진짜 주인과 빚을 확인해요.",
        body: [
          "등기부등본(정식 이름은 등기사항증명서)에는 이 집의 주인과 빚이 적혀 있어요. 사람으로 치면 이력서예요.",
          "갑구는 '주인 칸'이에요. 지금 집주인이 누구인지 보고, 나와 계약하는 사람과 같은 사람인지 확인해요.",
          "을구는 '빚 칸'이에요. 근저당처럼 내 보증금보다 먼저 돌려받는 권리가 있는지, 얼마인지 봐요.",
        ],
        where: [{ name: "대법원 인터넷등기소", url: "https://www.iros.go.kr/" }],
        whereLabel: "어디서 떼요",
        caution: "계약하는 날과 잔금 치르는 날, 한 번 더 떼서 그 사이 바뀐 게 없는지 확인해요.",
        terms: [
          {
            term: "근저당",
            meaning: "집을 담보로 돈을 빌려준 곳(주로 은행)이 잡아 둔 권리예요. 나보다 먼저 잡혀 있으면 집이 팔릴 때 나보다 먼저 돈을 가져가요.",
          },
        ],
      },
      {
        keyword: "건축물대장",
        title: "불법으로 고친 집은 아닌지 봐요",
        lead: "불법으로 고친 건물(위반건축물)은 아닌지 봐요.",
        body: [
          "건축물대장은 건물의 건강검진표예요. 여기에 '위반건축물'이라고 적혀 있지 않은지, 용도가 주택이 맞는지 봐요.",
        ],
        where: [
          { name: "정부24 건축물대장 발급", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098" },
          { name: "세움터", url: "https://www.eais.go.kr/" },
        ],
        whereLabel: "어디서 떼요",
        caution: "위반건축물이면 보증금 보험(전세보증금 반환보증) 가입이 막힐 수 있어요.",
      },
      {
        keyword: "계약하는 사람",
        title: "앞에 있는 사람, 진짜 주인인가요?",
        lead: "등기부의 주인과 지금 앞에 있는 사람이 같은 사람인지 확인해요.",
        body: [
          "신분증을 보고 등기부 '주인 칸'(갑구)의 이름과 맞춰 봐요.",
          "집주인 대신 다른 사람(대리인)이 나오면, 집주인의 위임장과 인감증명서를 꼭 받아요.",
        ],
        caution: "계약금과 잔금은 등기부에 적힌 주인 이름의 계좌로만 보내요.",
      },
      {
        keyword: "보증보험",
        title: "들 수 있는 집인지 계약 전에 묻기",
        lead: "계약하기 전에, 보증금 보험에 들 수 있는 집인지 물어봐요.",
        body: [
          "보증금 보험(전세보증금 반환보증)은 계약이 끝났는데 보증금을 못 돌려받을 때 보증기관이 대신 돌려주는 상품이에요.",
          "모든 집이 가입되는 건 아니에요. 계약서에 도장 찍기 전에 보증기관에 이 집이 가입할 수 있는지 물어봐요.",
        ],
        where: [
          {
            name: "주택도시보증공사(HUG) 안심전세 앱",
            url: "https://www.khug.or.kr/jeonse/web/s01/s010102.jsp",
            note: "가입할 수 있는 집인지 앱에서 확인해요",
          },
        ],
      },
    ],
    sources: [
      { name: "주택도시보증공사 안심전세포털", topic: "전세사기 피해 예방", url: "https://www.khug.or.kr/jeonse/" },
      { name: "찾기쉬운 생활법령", topic: "주택임대차", url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=629" },
      { name: "대법원 인터넷등기소", url: "https://www.iros.go.kr" },
      { name: "세움터", topic: "건축물대장", url: "https://www.eais.go.kr" },
      { name: "국토교통부 실거래가 공개시스템", url: "https://rt.molit.go.kr" },
    ],
  },
  {
    id: "protect-deposit",
    title: "보증금 지키는 법",
    summary: "깃발(전입신고)과 번호표(확정일자)",
    icon: "guarantee",
    checkedAt: "2026-11-22",
    sections: [
      {
        keyword: "전입신고",
        title: "이사한 날, '나 여기 살아요' 깃발 꽂기",
        lead: "이사한 날, 바로 전입신고부터 해요.",
        body: [
          "전입신고는 새 집에 '나 여기 살아요' 깃발을 꽂는 일이에요.",
          "실제로 들어가 살면서 깃발까지 꽂으면, 다음 날 0시부터 '대항력'이 생겨요. 집주인이 바뀌어도 계약한 대로 계속 살 수 있는 힘이에요.",
        ],
        where: [{ name: "정부24 전입신고", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000016" }, { name: "새 주소의 주민센터" }],
        caution:
          "깃발은 다음 날부터 힘이 생겨요. 잔금 날 집주인이 은행 대출(근저당)을 새로 잡으면 은행이 나보다 앞줄에 설 수 있어요. 잔금 직전에 등기부를 한 번 더 봐요.",
        terms: [
          {
            term: "대항력",
            meaning: "집에 들어가 살면서(인도) 전입신고까지 마치면 다음 날 0시부터 생기는 힘이에요. 집주인이 바뀌어도 계속 살 수 있어요.",
          },
        ],
      },
      {
        keyword: "확정일자",
        title: "계약서에 번호표를 받아 둬요",
        lead: "계약서에 확정일자를 받아요.",
        body: [
          "집이 경매로 넘어가면 돈 받을 사람들이 줄을 서요. 확정일자는 그 줄의 번호표예요.",
          "깃발(이사 + 전입신고)과 번호표(확정일자)를 둘 다 가지면, 나보다 뒤 순서인 사람보다 먼저 보증금을 받아요.",
          "다음 장의 임대차 신고를 하면 이 번호표가 저절로, 무료로 붙어요.",
        ],
        where: [
          { name: "주민센터", note: "계약서에 받기" },
          { name: "대법원 인터넷등기소", url: "https://www.iros.go.kr/", note: "온라인" },
        ],
        terms: [
          {
            term: "우선변제권",
            meaning: "대항력에 확정일자까지 갖추면 생겨요. 집이 경매로 넘어가도 뒤 순서 채권자보다 먼저 보증금을 받는 권리예요.",
          },
        ],
      },
      {
        keyword: "임대차 신고",
        title: "30일 안에 신고하면 번호표는 덤",
        lead: "신고 대상이면 계약한 날부터 30일 안에 신고해요.",
        body: [
          "보증금이 6천만 원을 넘거나 월세가 30만 원을 넘는 계약은 계약한 날부터 30일 안에 신고해야 해요.",
          "신고할 때 계약서를 함께 내면, 확정일자(앞 장의 번호표)를 따로 신청하지 않아도 무료로 붙어요.",
        ],
        where: [{ name: "정부24 주택 임대차신고", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=16130000132" }],
        caution: "신고 대상 지역이 정해져 있어요. 내 지역이 대상인지는 국토교통부 안내에서 확인해요.",
      },
      {
        keyword: "반환보증",
        title: "못 돌려받을 때를 대비한 보험이에요",
        lead: "보증금 보험에 바로 들 수 있는지 확인해요.",
        body: [
          "계약이 끝났는데 집주인이 보증금을 못 돌려주면, 보증기관이 대신 돌려주는 상품이에요. 사고가 났을 때를 대비하는 보험과 같아요.",
          "가입 기한과 조건이 있어요. 계약하고 나면 바로 가입할 수 있는지 확인해요.",
        ],
        where: [{ name: "주택도시보증공사(HUG) 보증가입", url: "https://www.khug.or.kr/jeonse/web/s04/s040201.jsp" }],
      },
      {
        keyword: "임차권등기",
        title: "보증금 못 받고 이사해야 한다면?",
        lead: "보증금을 못 받고 이사해야 하면, 임차권등기부터 마치고 이사해요.",
        body: [
          "그냥 이사하면서 주소를 옮기면, 깃발(대항력)과 번호표(우선변제권)의 힘이 사라질 수 있어요.",
          "임차권등기는 '나 아직 보증금 못 받았어요'라는 표시를 등기부에 남겨 두는 거예요. 이걸 마치면 주소를 옮겨도 대항력과 우선변제권이 그대로 남아요.",
        ],
        caution: "순서가 중요해요. 임차권등기를 먼저 마치고, 그다음에 이사해요.",
        terms: [
          {
            term: "임차권등기",
            meaning: "보증금을 돌려받지 못한 세입자가 등기부에 임차권을 올려 두는 것이에요. 마친 뒤에는 이사해도 대항력 · 우선변제권이 남아요.",
          },
        ],
      },
    ],
    sources: [
      { name: "찾기쉬운 생활법령", topic: "주택임대차(대항력·우선변제권·임차권등기)", url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=629" },
      { name: "정책브리핑", topic: "주택 임대차 신고제 대상과 방법", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148888172" },
      { name: "정책브리핑", topic: "임대차 신고 때 확정일자 자동·무료 부여", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148928316" },
      { name: "주택도시보증공사 안심전세포털", url: "https://www.khug.or.kr/jeonse/" },
      { name: "대법원 인터넷등기소", topic: "온라인 확정일자", url: "https://www.iros.go.kr" },
    ],
  },
  {
    id: "where-documents",
    title: "서류 떼는 곳 모음",
    summary: "어디서 떼는지 한눈에",
    icon: "resident",
    checkedAt: "2026-11-22",
    sections: [
      {
        keyword: "서류 지도",
        title: "어디서 떼요? 한눈에 보기",
        lead: "지원금 신청에 자주 나오는 서류와 떼는 곳이에요.",
        body: [
          "대부분 정부24에서 한 번에 뗄 수 있어요. 정부24에 없는 서류는 그 서류를 만드는 기관에서 떼요.",
          "무인민원발급기에서 뗄 수 있는 서류는 지도에서 서류별로 골라 볼 수 있어요. 발급기마다 뗄 수 있는 서류가 달라요.",
        ],
        // 누르면 정부24 발급 화면(본문: 대부분 정부24에서 한 번에). 덧말은 떼는 곳 전부 — 링크가 여는 곳을 맨 앞에
        where: [
          { name: "주민등록등본", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015", note: "정부24(온라인) · 주민센터 · 무인민원발급기" },
          { name: "가족관계증명서", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=97400000004", note: "정부24 · 대법원 전자가족관계등록시스템" },
          { name: "건강보험 자격득실확인서", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=PG4CADM0107", note: "정부24 · 국민건강보험공단 누리집·앱" },
          { name: "소득금액증명", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000021", note: "정부24 · 국세청 홈택스·손택스" },
          { name: "임대차계약서 사본", note: "내 계약서. 확정일자가 찍힌 면까지 함께" },
          { name: "건축물대장", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098", note: "정부24 · 세움터" },
          { name: "등기부등본", url: "https://www.iros.go.kr/", note: "대법원 인터넷등기소" },
        ],
        whereLabel: "어디서 떼요",
        placesMap: true,
      },
      {
        keyword: "떼기 전에",
        title: "서류에도 유통기한이 있어요",
        lead: "미리 떼 두지 말고, 내기 직전에 떼요.",
        body: [
          "제출하는 곳마다 '최근 1개월 안에 뗀 것'처럼 날짜 기준이 있어요. 우유처럼 미리 사 두면 날짜가 지나 버려요.",
          "온라인으로 떼려면 공동인증서 · 금융인증서나 간편인증이 필요해요.",
        ],
        caution: "정부24가 점검 중이면, 위 기관 누리집에서 따로 뗄 수 있어요.",
      },
    ],
    sources: [
      { name: "정부24", url: "https://www.gov.kr" },
      { name: "대법원 전자가족관계등록시스템", url: "https://efamily.scourt.go.kr" },
      { name: "국민건강보험공단", url: "https://www.nhis.or.kr" },
      { name: "국세청 홈택스", url: "https://www.hometax.go.kr" },
      { name: "세움터", url: "https://www.eais.go.kr" },
      { name: "대법원 인터넷등기소", url: "https://www.iros.go.kr" },
      { name: "행정안전부 무인민원발급기정보", topic: "익산 발급기 위치·운영시간·발급 서류", url: "https://www.data.go.kr/data/15154774/openapi.do" },
    ],
  },
];

export function findGuide(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
/**
 * 홈 가이드 줄의 순서 — 처음 고른 집 형태로 첫 카드를 바꾸고 꼬리표를 단다 (docs/기획/2026-11-20-홈-보강-설계.md 5절).
 * 월세는 지원금 신청에 낼 서류가 많고, 전세는 지켜야 할 보증금이 커서 그걸 먼저. /guides 전체 목록 순서는 그대로다.
 */
const HOUSING_ORDER: Partial<Record<HousingType, string[]>> = {
  월세: ["where-documents", "protect-deposit", "before-contract"],
  연세: ["where-documents", "protect-deposit", "before-contract"],
  전세: ["protect-deposit", "before-contract", "where-documents"],
};

export function guidesForHousing(housingType: HousingType | null): { guides: Guide[]; tag: string | null } {
  const order = housingType ? HOUSING_ORDER[housingType] : undefined;
  if (!order) return { guides: GUIDES, tag: null };
  return { guides: order.flatMap((id) => findGuide(id) ?? []), tag: `${housingType}라면 먼저` };
}
