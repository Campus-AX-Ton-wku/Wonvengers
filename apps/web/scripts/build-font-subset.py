#!/usr/bin/env python3
"""Pretendard 를 이 앱이 쓰는 글자만 남겨 서브셋한다.

── 왜 서브셋인가 ──────────────────────────────────────────────────

한글 폰트는 무겁다. 실측(2026-08-27, Pretendard v1.3.9):

    PretendardVariable.woff2      2,009 KB   한글 11,172자 · 전 웨이트
    Pretendard-Regular.woff2        748 KB   한글 11,172자 · 한 웨이트
    이 스크립트의 산출물             ~141 KB   한글 ~590자 · 전 웨이트

앱이 실제로 렌더하는 한글은 590자쯤이다. 정적 웨이트로 400~800 을 덮으면
3.7MB 가 되므로 가변 폰트를 쓰고, 거기서 안 쓰는 글자를 덜어낸다.

**주의 — PretendardStd 는 라틴 전용이다.** 이름이 서브셋처럼 보이지만 한글
글리프가 0자다 (285KB 인데도). 반드시 `PretendardVariable.woff2` 를 쓴다.

── 조용히 깨지는 지점 ─────────────────────────────────────────────

서브셋에 없는 음절은 폴백 폰트로 그려진다. 문장 중간에서 글꼴이 바뀌는데
에러는 안 난다. 그래서 문자 목록(subset-charset.txt)을 폰트와 **함께** 내보내고,
lib/__tests__/font-coverage.test.ts 가 소스·정책 데이터의 한글이 그 목록에
들어 있는지 검사한다. 정책 문구가 바뀌면 그 테스트가 먼저 실패한다.

즉 이 스크립트를 다시 돌려야 하는 신호는 테스트가 알려준다. 평소에는 돌릴
필요가 없다.

── 실행 ───────────────────────────────────────────────────────────

    # 원본은 저장소에 두지 않는다 (2MB). 필요할 때 받는다.
    curl -sLO https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip
    unzip -j Pretendard-1.3.9.zip 'web/variable/woff2/PretendardVariable.woff2'

    python3 scripts/build-font-subset.py --source PretendardVariable.woff2

의존성: fonttools, brotli (`pip install fonttools brotli`)
"""

import argparse
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
FONT_DIR = os.path.join(WEB, "app", "fonts")

# 앱 소스와 정책 데이터. 화면에 나올 수 있는 문자는 여기서 나온다.
SOURCES = ["app/**/*.tsx", "app/**/*.ts", "lib/**/*.ts", "data/*.json"]

# 소스에 아직 없어도 넣어두는 것들. 문장부호는 언제든 쓰이고, 하나 빠지면
# 그 글자만 다른 폰트로 그려져 눈에 띈다.
EXTRA = "".join(chr(c) for c in range(0x20, 0x7F)) + "·―—–…‘’“”※→←↑↓°㎡₩％"


def 앱이_쓰는_문자() -> set:
    글자 = set()
    for 패턴 in SOURCES:
        for 경로 in glob.glob(os.path.join(WEB, 패턴), recursive=True):
            if "__tests__" in 경로 or "/fonts/" in 경로:
                continue
            with open(경로, encoding="utf-8") as f:
                글자 |= set(f.read())
    글자 |= set(EXTRA)

    # 이모지는 서브셋에 넣지 않는다 — Pretendard 에 없고, 기기 이모지 폰트가 그린다.
    return {c for c in 글자 if ord(c) > 0x1F and not (0x1F300 <= ord(c) <= 0x1FAFF)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="PretendardVariable.woff2 경로")
    args = ap.parse_args()

    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        print("fonttools 가 필요하다: pip install fonttools brotli", file=sys.stderr)
        return 1

    원본 = TTFont(args.source)
    한글수 = sum(1 for c in 원본.getBestCmap() if 0xAC00 <= c <= 0xD7A3)
    if 한글수 == 0:
        print(
            f"'{args.source}' 에 한글 글리프가 없다. PretendardStd 를 넣었을 가능성이 크다 "
            "— 라틴 전용 판이다. PretendardVariable.woff2 를 쓸 것.",
            file=sys.stderr,
        )
        return 1

    문자 = 앱이_쓰는_문자()
    한글 = sorted(c for c in 문자 if "가" <= c <= "힣")
    print(f"원본: {한글수:,}자 → 서브셋 대상: {len(문자)}자 (한글 {len(한글)}자)")

    os.makedirs(FONT_DIR, exist_ok=True)
    폰트경로 = os.path.join(FONT_DIR, "Pretendard-subset.woff2")
    목록경로 = os.path.join(FONT_DIR, "subset-charset.txt")

    subset.main([
        args.source,
        f"--text={''.join(sorted(문자))}",
        f"--output-file={폰트경로}",
        "--flavor=woff2",
        "--layout-features=*",
        "--drop-tables+=DSIG",
    ])

    # 폰트와 목록을 같은 실행에서 함께 쓴다. 따로 갱신되면 테스트가 거짓 통과한다.
    with open(목록경로, "w", encoding="utf-8") as f:
        f.write("".join(sorted(문자)))

    결과 = TTFont(폰트경로)
    print(f"→ {폰트경로} ({os.path.getsize(폰트경로) / 1024:.1f} KB)")
    print(f"   한글 {sum(1 for c in 결과.getBestCmap() if 0xAC00 <= c <= 0xD7A3)}자 · "
          f"가변 축 {'유지' if 'fvar' in 결과 else '없음'}")
    print(f"→ {목록경로}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
