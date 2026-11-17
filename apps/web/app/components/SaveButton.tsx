"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { hasStoredLogin, isLoginAvailable } from "@/lib/auth";
import { isSaved } from "@/lib/saved";
import { loadSaved, onLocalChange, toggleSavedPolicy } from "@/lib/storage";
import { Heart, ICON_MD } from "./icons";
import { LoginSheet } from "./LoginSheet";

/**
 * ♡ 찜 (docs/기획/2026-11-17-홈-찜하기-설계.md "1. 찜하기"). 로그인한 사람만 —
 * 로그인을 쓸 수 없는 빌드에서는 그리지 않는다. 카드(링크) 안에 놓여도 카드 이동을 막는다.
 */
export function SaveButton({ policyId, policyName, className = "" }: { policyId: string; policyName: string; className?: string }) {
  const [available, setAvailable] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    setAvailable(isLoginAvailable());
    const read = () => setSaved(isSaved(loadSaved(), policyId));
    read();
    return onLocalChange(read);
  }, [policyId]);

  if (!available) return null;

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!hasStoredLogin()) {
      setLoginOpen(true);
      return;
    }
    setSaved(toggleSavedPolicy(policyId));
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={`${policyName} 찜하기`}
        onClick={onClick}
        className={`focus-ring inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-brand-50 ${
          saved ? "text-accent-600" : "text-ink-500"
        } ${className}`}
      >
        <Heart size={ICON_MD} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
      </button>
      {loginOpen && (
        <LoginSheet
          title="로그인하고 찜해 둘까요?"
          description="카카오로 3초 만에 로그인하면 관심 있는 지원금을 모아 두고 신청 준비까지 이어서 볼 수 있어요."
          next={`${window.location.pathname}${window.location.search}`}
          onClose={() => setLoginOpen(false)}
        />
      )}
    </>
  );
}
