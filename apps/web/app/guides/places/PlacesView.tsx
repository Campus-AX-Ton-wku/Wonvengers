"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, buttonClass, telHref, TopBar } from "@/app/components";
import { ArrowUpRight, Compass, ICON_SM, MapPin, Phone } from "@/app/components/icons";
import { loadKakaoMaps, type KakaoMaps } from "@/lib/kakao-map";
import {
  directionsUrl,
  distanceKm,
  filterPlaces,
  formatDistance,
  isNearAny,
  KIOSK_DOCS,
  NEAR_KM,
  type CivilPlace,
  type KioskDocKey,
  type PlaceKind,
} from "@/lib/places";

const KIND_LABEL: Record<PlaceKind, string> = { office: "주민센터", kiosk: "무인민원발급기" };
const docLabel = (key: KioskDocKey) => KIOSK_DOCS.find((d) => d.key === key)!.label;

type MapState = "loading" | "ready" | "failed";

/**
 * 서류 떼는 곳 지도 (11/22 ggue). 지도는 카카오 SDK, 같은 데이터를 목록으로도 — 화면 읽기 프로그램은 지도를 못 쓴다.
 * 위치 권한은 [내 위치]를 누를 때만 묻고, 받은 위치는 이 화면에서 지도 가운데와 거리 계산에만 쓴다(저장 · 전송 안 함).
 */
export function PlacesView({
  places,
  generatedAt,
  jsKey,
}: {
  places: CivilPlace[];
  generatedAt: string | null;
  jsKey: string | undefined;
}) {
  const [kind, setKind] = useState<"all" | PlaceKind>("all");
  const [doc, setDoc] = useState<KioskDocKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapState, setMapState] = useState<MapState>("loading");
  const mapEl = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mapRef = useRef<{ maps: KakaoMaps; map: KakaoMaps; overlays: KakaoMaps[] } | null>(null);

  const shown = useMemo(() => {
    const list = filterPlaces(places, { kind, doc });
    return me ? [...list].sort((a, b) => distanceKm(me, a) - distanceKm(me, b)) : list;
  }, [places, kind, doc, me]);
  // 내 위치가 익산에서 멀면 지도를 옮기지 않는다 (서울에서 누르면 점 하나만 보이므로)
  const meFar = useMemo(() => (me ? !isNearAny(me, places, NEAR_KM) : false), [me, places]);
  const docChips = useMemo(() => KIOSK_DOCS.filter((d) => places.some((p) => p.documents.includes(d.key))), [places]);
  const selected = shown.find((p) => p.id === selectedId) ?? null;

  // 장소를 고르면 카드로 — 지도가 화면을 채워 카드가 밖에 있을 수 있고, 화면 읽기 프로그램에도 알린다
  useEffect(() => {
    if (!selectedId) return;
    cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    cardRef.current?.focus({ preventScroll: true });
  }, [selectedId]);

  // 지도 SDK — 장소가 있을 때만
  useEffect(() => {
    if (places.length === 0) return;
    let alive = true;
    loadKakaoMaps(jsKey)
      .then((maps) => {
        if (!alive || !mapEl.current) return;
        const map = new maps.Map(mapEl.current, { center: new maps.LatLng(35.9483, 126.9577), level: 7 });
        mapRef.current = { maps, map, overlays: [] };
        setMapState("ready");
      })
      .catch(() => alive && setMapState("failed"));
    return () => {
      alive = false;
    };
  }, [jsKey, places.length]);

  // 거른 장소를 지도에 — 바뀔 때마다 다시 그린다
  useEffect(() => {
    const m = mapRef.current;
    if (mapState !== "ready" || !m) return;
    for (const o of m.overlays) o.setMap(null);
    const bounds = new m.maps.LatLngBounds();
    m.overlays = shown.map((p) => {
      const pos = new m.maps.LatLng(p.lat, p.lng);
      bounds.extend(pos);
      const el = document.createElement("button");
      el.type = "button";
      el.tabIndex = -1;
      el.setAttribute("aria-label", p.name);
      el.className = "grid size-11 place-items-center";
      const dot = document.createElement("span");
      dot.className =
        p.kind === "office"
          ? "block size-5 rounded-full border-2 border-white bg-brand-700 shadow-card"
          : "block size-5 rounded-full border-2 border-white bg-warn-800 shadow-card";
      el.appendChild(dot);
      el.addEventListener("click", () => setSelectedId(p.id));
      return new m.maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5, clickable: true, map: m.map });
    });
    if (me && !meFar) {
      const dot = document.createElement("span");
      dot.className = "block size-4 rounded-full border-2 border-white bg-ok-600 shadow-card";
      m.overlays.push(new m.maps.CustomOverlay({ position: new m.maps.LatLng(me.lat, me.lng), content: dot, yAnchor: 0.5, map: m.map }));
      m.map.setCenter(new m.maps.LatLng(me.lat, me.lng));
      m.map.setLevel(5);
    } else if (shown.length > 0) {
      m.map.setBounds(bounds);
    }
  }, [mapState, shown, me, meFar]);

  function locate() {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) {
      setNotice("위치 권한이 없어 익산 전체를 보여 드려요");
      return;
    }
    geo.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setNotice(
          isNearAny(here, places, NEAR_KM) ? "가까운 순으로 바꿨어요" : "지금 계신 곳이 익산에서 멀어 익산 전체를 보여 드려요"
        );
        setMe(here);
      },
      (err) =>
        setNotice(err?.code === 1 ? "위치 권한이 없어 익산 전체를 보여 드려요" : "위치를 찾지 못해 익산 전체를 보여 드려요"),
      { timeout: 8_000, maximumAge: 60_000 }
    );
  }

  const chip = (active: boolean) =>
    `focus-ring h-9 shrink-0 rounded-full px-3.5 text-sm font-bold ${active ? "bg-brand-600 text-white" : "bg-surface text-ink-700 shadow-card"}`;

  if (places.length === 0) {
    return (
      <AppShell>
        <TopBar backHref="/guides/where-documents/1" />
        <main className="flex flex-1 flex-col gap-4 pt-2.5">
          <h1 className="text-[26px] font-extrabold text-ink-900">서류 떼는 곳 지도</h1>
          <p className="text-[15px] text-ink-700">아직 보여 줄 곳이 없어요</p>
          <Link href="/guides/where-documents/1" className={buttonClass({ variant: "secondary", size: "md" })}>
            온라인으로 떼는 곳 보기
          </Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar backHref="/guides/where-documents/1" />
      <main className="flex flex-1 flex-col gap-3 pb-10 pt-2.5">
        <h1 className="text-[26px] font-extrabold text-ink-900">서류 떼는 곳 지도</h1>

        <div role="group" aria-label="장소 종류" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {(["all", "office", "kiosk"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              className={chip(kind === k)}
              onClick={() => {
                setKind(k);
                if (k !== "kiosk") setDoc(null);
              }}
            >
              {k === "all" ? "전체" : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {kind === "kiosk" && (
          <div role="group" aria-label="서류" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {docChips.map((d) => (
              <button key={d.key} type="button" aria-pressed={doc === d.key} className={chip(doc === d.key)} onClick={() => setDoc(doc === d.key ? null : d.key)}>
                {d.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-3 text-xs text-ink-600">
            <span className="flex items-center gap-1"><span aria-hidden="true" className="size-3 rounded-full bg-brand-700" />주민센터</span>
            <span className="flex items-center gap-1"><span aria-hidden="true" className="size-3 rounded-full bg-warn-800" />무인민원발급기</span>
          </p>
          <button type="button" onClick={locate} className={buttonClass({ variant: "quiet", size: "md" })}>
            <Compass size={ICON_SM} aria-hidden="true" />
            내 위치
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-ink-600">{notice}</p>

        {mapState === "failed" ? (
          <p className="rounded-card bg-ink-50 p-4 text-sm text-ink-700">지도를 불러오지 못했어요 — 목록으로 보여 드려요</p>
        ) : (
          <div ref={mapEl} aria-hidden="true" className="h-[52vh] min-h-[280px] overflow-hidden rounded-card bg-ink-100" />
        )}

        {selected && (
          <section ref={cardRef} tabIndex={-1} aria-labelledby="place-card" className="focus-ring flex flex-col gap-1.5 rounded-card bg-surface p-4 shadow-card">
            <p className="text-xs font-bold text-brand-700">{KIND_LABEL[selected.kind]}</p>
            <h2 id="place-card" className="text-lg font-extrabold text-ink-900">{selected.name}</h2>
            <p className="text-sm text-ink-700">{selected.address}</p>
            {selected.detail && <p className="text-sm text-ink-600">{selected.detail}</p>}
            {selected.weekday && <p className="text-sm text-ink-700">평일 {selected.weekday}</p>}
            {selected.holiday && <p className="text-sm text-ink-700">공휴일 {selected.holiday}</p>}
            {selected.hoursNote && <p className="text-xs text-ink-500">{selected.hoursNote}</p>}
            {selected.documents.length > 0 && (
              <p className="text-sm text-ink-700">뗄 수 있는 서류: {selected.documents.map(docLabel).join(" · ")}</p>
            )}
            <div className="mt-2 flex gap-2">
              <a
                href={directionsUrl(selected)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ variant: "primary", size: "md" })}
              >
                길찾기
                <ArrowUpRight size={ICON_SM} aria-hidden="true" />
              </a>
              {selected.phone && (
                <a href={telHref(selected.phone)} className={buttonClass({ variant: "secondary", size: "md" })}>
                  <Phone size={ICON_SM} aria-hidden="true" />
                  전화
                </a>
              )}
            </div>
          </section>
        )}

        {shown.length === 0 && <p className="text-sm text-ink-700">조건에 맞는 곳이 없어요</p>}
        <ul aria-label="장소 목록" className="flex flex-col gap-2">
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                aria-pressed={selectedId === p.id}
                className="focus-ring flex w-full items-start gap-2.5 rounded-card bg-surface p-3.5 text-left shadow-card"
              >
                <MapPin size={ICON_SM} aria-hidden="true" className={`mt-1 shrink-0 ${p.kind === "office" ? "text-brand-700" : "text-warn-800"}`} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-bold text-ink-900">{p.name}</span>
                  <span className="text-xs text-ink-600">
                    {KIND_LABEL[p.kind]}
                    {me && ` · 직선 ${formatDistance(distanceKm(me, p))}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="text-xs text-ink-500">
          출처: 행정안전부 무인민원발급기정보 · 카카오 장소 · 주소 검색{generatedAt ? ` · ${generatedAt} 기준` : ""}
        </p>
      </main>
    </AppShell>
  );
}
