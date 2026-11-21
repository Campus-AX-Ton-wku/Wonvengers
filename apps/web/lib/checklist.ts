import { findGuide, type Guide, type GuideSource } from "./guides";

/**
 * 집 보러 갈 때 체크리스트 (docs/기획/2026-11-22-집-보기-체크리스트-설계.md, ggue 11/22).
 *
 * 줄마다 공식 출처의 문장이 받쳐 준다(11/22 원문 확인, 설계 문서 3절). 출처가 말하는 데까지만 쓴다 —
 * 수압 재는 방법 · 결로 · 낮밤 두 번 가 보기처럼 공식 출처를 못 찾은 것은 넣지 않았다.
 * 판정하지 않는다: 다 체크해도 "계약해도 돼요"라고 말하지 않는다.
 * 수리 책임 특약은 '있는지 봐요'까지만 — 생활법령에 특약으로 넘길 수 있다는 문장이 있어 '무효'라고 쓰면 틀린다.
 * 서류 다섯 줄은 '계약 전에 꼭 볼 것' 장의 용어 · 한 줄 할 일을 그대로 쓴다(글을 두 곳에 두지 않는다).
 */

export type ChecklistSourceKey = "A" | "B" | "C" | "D" | "F" | "G" | "H";

export interface ChecklistItem {
  /** 기록(perky.checklist)에 남는 이름 — 바꾸면 그 줄 체크가 사라진다 */
  id: string;
  label: string;
  /** 어떻게 봐요 — 한두 문장 */
  how: string;
  /** 받쳐 주는 출처 (서류 줄은 가이드 출처를 따라 비운다) */
  sources: ChecklistSourceKey[];
}

export interface ChecklistGroup {
  id: string;
  title: string;
  items: ChecklistItem[];
  /** 무리 아래 '자세히' 한 줄 — 체크 줄 안에 링크를 넣으면 누르기가 겹쳐서 밖에 둔다 */
  more?: { href: string; label: string };
}

/** 원문 대조 11/22. G 는 휴대폰에서 화면에 안 뜨고 PDF 로 내려받아진다 */
export const CHECKLIST_SOURCES: (GuideSource & { key: ChecklistSourceKey })[] = [
  {
    key: "A",
    name: "정책브리핑",
    topic: "자취할 때 알아둬야 할 생활 법률 상식(국토교통부)",
    url: "https://www.korea.kr/news/policyNewsView.do?newsId=148920213",
  },
  {
    key: "B",
    name: "찾기쉬운 생활법령",
    topic: "이사 가고 싶은 집을 찾은 뒤 확인할 것",
    url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=666&ccfNo=1&cciNo=1&cnpClsNo=1",
  },
  {
    key: "C",
    name: "찾기쉬운 생활법령",
    topic: "이사할 곳 주변 조사하기",
    url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=666&ccfNo=1&cciNo=1&cnpClsNo=3",
  },
  {
    key: "D",
    name: "찾기쉬운 생활법령",
    topic: "공인중개사의 확인·설명 의무",
    url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=629&ccfNo=2&cciNo=2&cnpClsNo=3",
  },
  {
    key: "F",
    name: "찾기쉬운 생활법령",
    topic: "계약서 작성하기",
    url: "https://m.easylaw.go.kr/MOB/CsmInfoRetrieve.laf?csmSeq=666&ccfNo=2&cciNo=1&cnpClsNo=2",
  },
  {
    key: "G",
    name: "서울주거포털",
    topic: "주택임대차 계약 때 주요 확인사항(PDF)",
    url: "https://housing.seoul.go.kr/site/main/file/download/uu/5dab998d9d554787a3f49a60bcf2b14a",
  },
  {
    key: "H",
    name: "법무부",
    topic: "주택임대차 표준계약서",
    url: "https://www.moj.go.kr/bbs/moj/118/575868/artclView.do",
  },
];

const contract = findGuide("before-contract");

export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    id: "inside",
    title: "집 안",
    items: [
      { id: "water", label: "수압 · 물 빠짐", how: "집 안 곳곳 물을 틀어 수압을 보고, 세면대 물이 잘 빠지는지 봐요.", sources: ["A"] },
      { id: "mold", label: "곰팡이 · 물 샌 흔적", how: "화장실 · 벽지 · 장판에 곰팡이나 물이 샌 자국이 없는지 봐요.", sources: ["A", "G"] },
      {
        id: "light",
        label: "채광 · 방향",
        how: "창문이 몇 개인지, 햇빛이 잘 들고 바람이 통하는지 봐요. 남향이 트인 집이 햇빛 · 바람에 유리해요.",
        sources: ["A", "B", "C"],
      },
      {
        id: "heating",
        label: "난방 · 보일러",
        how: "난방 조절기를 확인하고, 보일러가 고칠 때가 됐거나 녹슨 곳은 없는지 봐요.",
        sources: ["A", "B"],
      },
      { id: "outlet", label: "콘센트", how: "콘센트가 몇 개이고 어디에 있는지 봐요.", sources: ["A"] },
      { id: "lock", label: "방충망 · 방범창 · 도어락", how: "방충망과 방범창이 멀쩡한지, 도어락이 잘 되는지 봐요.", sources: ["A", "G"] },
      { id: "sound", label: "방음", how: "옆집 · 윗집 소리가 잘 막히는지 봐요.", sources: ["A", "G"] },
      { id: "bugs", label: "벌레", how: "벌레가 나오는 집인지 봐요.", sources: ["A"] },
      { id: "meter", label: "수도 · 전기 계량기", how: "계량기가 우리 집 것만 따로 있는지 확인해요.", sources: ["G"] },
    ],
  },
  {
    id: "around",
    title: "주변",
    items: [
      { id: "commute", label: "학교 · 직장 가는 길", how: "학교나 직장까지 거리와 교통이 편한지 봐요.", sources: ["A", "C"] },
      { id: "night", label: "밤길", how: "CCTV · 가로등이 있는지, 파출소가 가까운지 봐요.", sources: ["A", "C"] },
      { id: "shops", label: "편의시설", how: "편의점 · 은행 · 마트가 가까운지 봐요.", sources: ["A", "C"] },
      { id: "street-noise", label: "주변 소음", how: "근처에 시끄러운 소리를 내는 곳이 없는지 봐요.", sources: ["A", "B"] },
    ],
  },
  {
    id: "money",
    title: "돈 · 계약",
    items: [
      {
        id: "fee",
        label: "관리비에 든 것",
        how: "관리비에 수도 · 가스 · 인터넷 · 주차비가 들었는지 물어봐요. 중개사는 관리비 금액과 내역을 설명해야 해요.",
        sources: ["G", "D"],
      },
      { id: "options", label: "옵션(빌트인)", how: "어떤 가전 · 가구가 들어 있는지 확인해요.", sources: ["G"] },
      {
        id: "repair",
        label: "고칠 곳은 계약서에",
        how: "고칠 곳이 있으면 무엇을 누가 고칠지 계약서에 적어요. 집주인이 할 수리를 세입자에게 넘기는 특약이 있는지도 봐요.",
        sources: ["H", "F", "G"],
      },
      {
        id: "photo",
        label: "집 상태 사진 · 영상",
        how: "입주할 때 집 상태를 사진 · 영상으로 남겨 둬요. 나갈 때 원상복구 다툼을 막아요.",
        sources: ["G"],
      },
    ],
  },
  {
    id: "paper",
    title: "서류",
    items: (contract?.sections ?? []).map((s) => ({ id: `paper:${s.keyword}`, label: s.keyword, how: s.lead, sources: [] })),
    more: { href: "/guides/before-contract", label: "자세히는 '계약 전에 꼭 볼 것'" },
  },
];

export const CHECKLIST_ITEM_IDS: string[] = CHECKLIST_GROUPS.flatMap((g) => g.items.map((i) => i.id));

/** 가이드 카드 모양 — id 가 'checklist' 라 GuideCard 가 /guides/checklist 로 보낸다 */
export const CHECKLIST_CARD: Pick<Guide, "id" | "title" | "summary" | "icon"> = {
  id: "checklist",
  title: "집 보러 갈 때 체크리스트",
  summary: "수압부터 밤길까지 하나씩",
  icon: "form",
};

/** 저장된 값을 체크한 id 목록으로 — 모르는 id(항목이 바뀐 뒤) · 겹침 · 깨진 값은 버린다 */
export function parseChecklist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(CHECKLIST_ITEM_IDS);
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && known.has(id)))];
}
