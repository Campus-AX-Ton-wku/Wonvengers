import { AppShell, TopBar } from "@/app/components";

/**
 * 개인정보 처리방침 초안 (docs/기획/2026-11-04-카카오-로그인-설계.md '화면' 6).
 * 정식 공개 전 팀·학교 검토를 거친다 — 법률 검토는 범위 밖이다.
 * 문의처·보호책임자처럼 아직 정하지 않은 값은 지어내지 않고 "확인 필요"로 둔다(F0-5).
 * 항목·보관 기간은 app/auth/consent/page.tsx 의 STORED_ITEMS·FACTS 와 같은 말로 맞춘다.
 */

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. 수집하는 항목",
    items: [
      "로그인하지 않으면 수집하지 않아요. 고른 답은 이용자 기기의 브라우저에만 저장돼요.",
      "카카오로 로그인하고 저장에 동의하면: 첫 질문의 답(생년월일, 사는 곳, 현재 상태, 주거 형태), 월 소득 구간(민감 정보), 계약 조건(지역, 계약 형태, 보증금·월세·관리비, 이사 비용, 계약 시작일, 거주 개월 수), 자격 질문의 답(가구원 수, 본인·부모 가구 소득, 재산 기준 충족 여부, 기초생활수급·차상위 여부, 무주택 여부 등 — 민감 정보), 결과 화면에서 직접 답한 조건(민감 정보일 수 있어요), 신청 체크리스트, 동의 시각, 마지막 저장 시각.",
      "로그인 정보: 카카오 회원번호는 로그인 서비스(Amazon Cognito)에만 남아요. 답 저장소에는 로그인 서비스가 만든 무작위 번호만 저장해요.",
    ],
  },
  {
    title: "2. 이용 목적",
    items: ["다른 기기에서 고른 답을 이어 보기. 이 목적 밖으로 쓰거나 제3자에게 제공하지 않아요."],
  },
  {
    title: "3. 보관 기간",
    items: [
      "마지막 저장 후 1년. 그동안 저장이 없으면 자동으로 지워져요.",
      "실수 복구용 백업(시점 복구)은 최대 35일 동안 남았다가 사라져요.",
      "서버 접속 기록은 30일 보관하고, 사용자 번호는 되돌릴 수 없는 값(해시)으로만 남겨요.",
      "동의는 기기마다 기록해요. 다른 기기에서는 다시 동의해야 저장돼요.",
    ],
  },
  {
    title: "4. 처리 위탁",
    items: [
      "Amazon Web Services, Inc. — 로그인(Amazon Cognito)과 답 저장(Amazon DynamoDB). 데이터는 AWS 서울 리전(대한민국)에 저장돼요. 운영사는 미국 기업이에요.",
      "카카오 — 로그인 인증. 카카오 계정으로 로그인할 때 카카오가 회원번호를 로그인 서비스에 알려 줘요.",
      "웹사이트 전송 업체의 접속 기록과 국외 이전 해당 여부: 확인 필요 — 정식 공개 전 검토해요.",
    ],
  },
  {
    title: "5. 파기 절차",
    items: [
      "회원 탈퇴(내 계정 › 회원 탈퇴): 카카오 연결 끊기 → 저장된 답 삭제 → 로그인 계정 삭제 순서로 바로 지워요. 이 기기의 사본도 지워요.",
      "로그아웃하면 이 기기의 사본을 지워요(공용 기기에 남지 않게). 서버의 답은 남아요.",
      "'처음부터 다시'를 하면 고른 답을 비우고, 로그인 상태면 서버의 답도 비워요.",
    ],
  },
  {
    title: "6. 이용자의 권리",
    items: [
      "열람: 로그인하면 저장된 답이 그대로 화면에 보여요.",
      "삭제·동의 철회: '처음부터 다시'로 답을 비우거나, 회원 탈퇴로 전부 지울 수 있어요.",
    ],
  },
  {
    title: "7. 문의처",
    items: [
      "개인정보 보호책임자와 문의 방법: 확인 필요 — 정식 공개 전 팀이 정해 적어요.",
      "시행일: 확인 필요",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <AppShell>
      <TopBar backHref="/find" />
      <main className="flex flex-1 flex-col gap-6 pb-10 pt-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold leading-snug text-ink-900">개인정보 처리방침 (초안)</h1>
          <p className="w-fit rounded-control bg-warn-50 px-3 py-2 text-xs font-bold text-warn-800">
            2026-11-04 초안 · 정식 공개 전 팀·학교 검토를 거쳐요
          </p>
        </header>
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="text-base font-bold text-ink-900">{section.title}</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-600">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </AppShell>
  );
}
