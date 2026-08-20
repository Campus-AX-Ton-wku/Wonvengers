# Perky (퍼키)

청년 주거 지원금 **발견 → 실부담 계산** 웹앱.

> 팀 Wonvengers (원광대학교) · 멋쟁이사자처럼 Campus AX-Ton
> 기획 배경은 [docs/기획/PRD.md](docs/기획/PRD.md)

## 구조

```
web/     Next.js 앱 (배포 대상)
docs/    기획 · 디자인 · 발표 · 마케팅
```

배포 시 **Root Directory 를 `web` 으로** 지정한다. 레포 루트에는 앱이 없다.

## 화면

Perky는 두 층으로 동작한다. 1층만 완성되어도 제품으로 성립한다 (PRD).

```
/             랜딩
/find         1층 — 발견. 질문 4개로 해당될 수 있는 지원금 목록 + 태그
/calculate    2층 — 계약 조건 입력 (F1)
/eligibility  2층 — 정책 자격 판정 질문 (F2)
/result       2층 — 판정 결과 + 최종 예상 주거비 (F3, F4)
```

## 실행

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm test         # vitest
npm run build    # 정적 빌드 (output: "export")
```

## 데이터

정책 데이터는 `web/data/policies.json` **한 곳**에만 둔다.

- 2층 판정: `regionScope`, `requiredInputs`, `benefitType`, `monthlyCap` 등
- 1층 발견: 각 정책의 `discovery` 블록 (`ageMin`/`ageMax`/`regions`/`statuses`/`incomeBracketMax`)

`discovery.statuses` 와 `discovery.incomeBracketMax` 가 `null` 인 정책은 공식 공고
확인 전이라는 뜻이다. **값을 추정해 채우지 않는다** — `null` 이면 1층이 '확인 필요'
태그를 붙인다 (PRD F0-5).

## 주의

`verifiedAt` 이 `null` 이거나 `notes` 에 "미검증 초안"이 적힌 정책은 팀 교차검수 전이다.
발표·배포 전에 공식 공고로 확인해야 한다.
