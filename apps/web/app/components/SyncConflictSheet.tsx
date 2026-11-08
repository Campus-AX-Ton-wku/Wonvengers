"use client";

import { useState } from "react";
import { resolveConflict } from "@/lib/sync";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * "이 기기의 답과 저장된 답 중 무엇을 쓸까요?" (설계 '동기화 규칙'·409).
 * Esc·바깥으로 닫히지 않는다 — 둘 중 하나를 골라야 동기화가 다시 돈다.
 */
export function SyncConflictSheet({ onResolved }: { onResolved: (choice: "local" | "remote") => void }) {
  const [working, setWorking] = useState(false);

  async function choose(choice: "local" | "remote") {
    setWorking(true);
    try {
      await resolveConflict(choice);
      onResolved(choice);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Sheet
      title="이 기기의 답과 저장된 답 중 무엇을 쓸까요?"
      description="두 곳의 답이 달라요. 고른 쪽으로 맞추고, 고르지 않은 쪽은 지워져요."
      onClose={() => {}}
    >
      <Button size="screen" disabled={working} onClick={() => void choose("local")}>
        이 기기의 답
      </Button>
      <Button size="screen" variant="secondary" disabled={working} onClick={() => void choose("remote")}>
        저장된 답
      </Button>
    </Sheet>
  );
}
