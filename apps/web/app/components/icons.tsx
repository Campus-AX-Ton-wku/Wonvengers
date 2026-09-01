/**
 * 앱이 쓰는 아이콘 — lucide-react 하나로 통일한다.
 *
 * 예전에는 화면마다 SVG 를 직접 그렸고(app/icons.tsx), 그 옆에 이모지가 섞여 있었다
 * (🧩 💳 🏦 ⚠️ ✓). 이모지는 OS 마다 다른 그림이 나오고 색·굵기가 제멋대로라
 * 같은 화면에 아이콘 체계가 둘 있는 셈이었다. 기능 아이콘은 전부 여기서 가져온다.
 *
 * **직접 import 하지 말고 이 모듈을 거칠 것.** 한곳을 지나야 굵기·크기 규칙이
 * 유지되고, 어떤 아이콘이 이미 쓰이는지 한눈에 보인다.
 *
 * 규격 — stroke 2, 24 그리드, 라운드 캡(lucide 기본값). 크기는 두 가지만 쓴다:
 *   ICON_SM(16) 캡션·배지 안,  ICON_MD(20) 버튼·목록·제목 옆.
 * 아이콘만 있는 버튼은 IconButton 을 써서 접근 가능한 이름을 반드시 붙인다.
 */
export {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  HandCoins,
  Info,
  Landmark,
  ListChecks,
  MapPin,
  Pencil,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";

/** 캡션·배지 안. 12~13px 글씨 옆에서 이보다 크면 글자를 누른다. */
export const ICON_SM = 16;
/** 버튼·목록·제목 옆. 기본값. */
export const ICON_MD = 20;
/** 빈 상태·안내 카드의 큰 아이콘. 캐릭터를 쓰지 않는 자리에만. */
export const ICON_LG = 24;
