import data from "@/data/civil-places.json";
import type { CivilPlacesSnapshot } from "@/lib/places";
import { PlacesView } from "./PlacesView";

/** 서류 떼는 곳 지도 (docs/기획/2026-11-22-서류-떼는-곳-지도-설계.md). 데이터는 빌드 때 만든 스냅숏 */
export default function PlacesPage() {
  const snapshot = data as CivilPlacesSnapshot;
  return <PlacesView places={snapshot.places} generatedAt={snapshot.generatedAt} jsKey={process.env.NEXT_PUBLIC_KAKAO_JS_KEY} />;
}
