// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "@/app/components";

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      {open && (
        <Sheet
          title="정말 할까요?"
          description="되돌릴 수 없어요."
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <button type="button">첫째</button>
          <button type="button">둘째</button>
        </Sheet>
      )}
    </>
  );
}

async function 열기() {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: "열기" }));
  return { user, onClose, dialog: screen.getByRole("dialog", { name: "정말 할까요?" }) };
}

describe("Sheet", () => {
  it("제목이 이름이고 설명이 붙은 모달이며, 열리면 첫 버튼에 포커스", async () => {
    const { dialog } = await 열기();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("되돌릴 수 없어요.").id).toBe(dialog.getAttribute("aria-describedby"));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "첫째" }));
  });

  it("Tab 은 시트 안에서 돈다", async () => {
    const { user } = await 열기();
    await user.tab();
    expect(document.activeElement?.textContent).toBe("둘째");
    await user.tab();
    expect(document.activeElement?.textContent).toBe("첫째");
    await user.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe("둘째");
  });

  it("Esc 로 닫히고 연 버튼으로 포커스가 돌아온다", async () => {
    const { user, onClose } = await 열기();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "열기" }));
  });

  it("body 바로 아래에 그린다 — 여는 버튼이 sticky z-10 줄 안에 있어도 상단바 위에 뜨게", async () => {
    const { dialog } = await 열기();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it("바깥을 누르면 닫히고, 안을 누르면 닫히지 않는다", async () => {
    const { user, onClose, dialog } = await 열기();
    await user.click(screen.getByText("되돌릴 수 없어요."));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("data-autofocus 가 붙은 요소가 있으면 그쪽에 먼저 포커스 — 되돌릴 수 없는 확인은 안전한 쪽부터", () => {
    render(
      <Sheet title="지울까요?" onClose={() => {}}>
        <button type="button">지우기</button>
        <button type="button" data-autofocus>
          취소
        </button>
      </Sheet>
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "취소" }));
  });
});
