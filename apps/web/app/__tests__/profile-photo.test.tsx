// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/remote", () => ({
  loadRemote: vi.fn(),
  saveRemote: vi.fn(),
  deleteAccountRemote: vi.fn(),
  getPhotoRemote: vi.fn(),
  putPhotoRemote: vi.fn(),
  deletePhotoRemote: vi.fn(),
}));

import { ProfileAvatar } from "@/app/components";
import { ProfileSheet } from "@/app/account/ProfileSheet";
import { resetAuthForTests } from "@/lib/auth";
import { deletePhotoRemote, getPhotoRemote, putPhotoRemote } from "@/lib/remote";
import {
  choosePhoto,
  clampCrop,
  cropSource,
  loadLocalPhoto,
  removePhoto,
  syncPhoto,
  type CropView,
} from "@/lib/profile-photo";
import { PROFILE_PHOTO_DELETE_KEY, PROFILE_PHOTO_KEY, clearDeviceRecords } from "@/lib/storage";
import { DEFAULT_PROFILE_CARD } from "@/lib/profile-card";
import { enableLogin, signInAs } from "@/lib/__tests__/auth-fixtures";

/**
 * 프로필 사진 (11/23 — 사진도 계정에, 시안 '내 정보' · 설계 노트 '사진으로 꾸미기').
 * 서버 경로 · 형식 검사는 apps/api/test/photo.test.ts · app.test.ts.
 */

const IMG = "/9j/4AAQSkZJRgABAQ"; // JPEG 머리 — 내용은 상관없다
const AT = "2026-11-23T12:00:00.000Z";

beforeEach(() => {
  window.localStorage.clear();
  resetAuthForTests();
  vi.mocked(getPhotoRemote).mockReset();
  vi.mocked(putPhotoRemote).mockReset();
  vi.mocked(deletePhotoRemote).mockReset();
  enableLogin();
});
afterEach(() => vi.unstubAllEnvs());

describe("사진 맞추기 — 동그라미가 덮는 원본 자리", () => {
  const v = (over: Partial<CropView> = {}): CropView => ({ circle: 300, width: 1200, height: 800, zoom: 1, x: 0, y: 0, ...over });

  it("처음에는 짧은 변이 동그라미를 딱 덮는다 — 가로 사진이면 가운데 정사각형", () => {
    expect(cropSource(v())).toEqual({ sx: 200, sy: 0, size: 800 });
  });

  it("두 배로 키우면 가운데 절반", () => {
    expect(cropSource(v({ zoom: 2 }))).toEqual({ sx: 400, sy: 200, size: 400 });
  });

  it("끌어 옮긴 만큼 반대쪽을 잘라 온다 — 사진을 오른쪽으로 끌면 왼쪽 부분", () => {
    // 배율 300/800 — 화면 75px 는 원본 200px
    expect(cropSource(v({ x: 75 }))).toEqual({ sx: 0, sy: 0, size: 800 });
  });

  it("동그라미 밖으로 빈 곳이 보이게는 못 옮기고, 배율은 1~4 배", () => {
    expect(clampCrop(v({ x: 500, y: -500 }))).toMatchObject({ x: 75, y: 0 });
    expect(clampCrop(v({ zoom: 0.2 })).zoom).toBe(1);
    expect(clampCrop(v({ zoom: 9 })).zoom).toBe(4);
  });
});

describe("이 기기 사본과 서버 맞추기", () => {
  it("고르면 사본(아직 안 올림)에 두고 고른 때를 돌려준다", () => {
    const at = choosePhoto(IMG, new Date(AT));
    expect(at).toBe(AT);
    expect(loadLocalPhoto()).toEqual({ at: AT, image: IMG, uploaded: false });
  });

  it("못 올린 사진을 올리고 올렸다고 적는다", async () => {
    signInAs();
    choosePhoto(IMG, new Date(AT));
    vi.mocked(putPhotoRemote).mockResolvedValue();
    await syncPhoto({ ...DEFAULT_PROFILE_CARD, photoAt: AT });
    expect(putPhotoRemote).toHaveBeenCalledWith({ image: IMG, at: AT });
    expect(loadLocalPhoto()?.uploaded).toBe(true);
    expect(getPhotoRemote).not.toHaveBeenCalled();
  });

  it("올리기에 실패하면(예전 서버 · 오프라인) 사본은 그대로 — 다음에 다시", async () => {
    signInAs();
    choosePhoto(IMG, new Date(AT));
    vi.mocked(putPhotoRemote).mockRejectedValue(new Error("404"));
    await syncPhoto({ ...DEFAULT_PROFILE_CARD, photoAt: AT });
    expect(loadLocalPhoto()).toEqual({ at: AT, image: IMG, uploaded: false });
  });

  it("다른 기기에서 고른 사진(카드 photoAt 이 다름)을 받아 둔다", async () => {
    signInAs();
    vi.mocked(getPhotoRemote).mockResolvedValue({ image: IMG, at: AT });
    await syncPhoto({ ...DEFAULT_PROFILE_CARD, photoAt: AT });
    expect(loadLocalPhoto()).toEqual({ at: AT, image: IMG, uploaded: true });
  });

  it("서버 사진이 카드가 가리키는 것과 다르면(다른 기기가 아직 올리는 중) 받지 않는다", async () => {
    signInAs();
    vi.mocked(getPhotoRemote).mockResolvedValue({ image: IMG, at: "2026-11-22T00:00:00.000Z" });
    await syncPhoto({ ...DEFAULT_PROFILE_CARD, photoAt: AT });
    expect(loadLocalPhoto()).toBeNull();
  });

  it("지우면 사본을 지우고 서버에서도 지운다 — 실패하면 표시를 남겨 다음에 다시", async () => {
    signInAs();
    choosePhoto(IMG, new Date(AT));
    removePhoto();
    expect(loadLocalPhoto()).toBeNull();
    vi.mocked(deletePhotoRemote).mockRejectedValueOnce(new Error("offline"));
    await syncPhoto(DEFAULT_PROFILE_CARD);
    expect(window.localStorage.getItem(PROFILE_PHOTO_DELETE_KEY)).toBe("1");
    vi.mocked(deletePhotoRemote).mockResolvedValueOnce();
    await syncPhoto(DEFAULT_PROFILE_CARD);
    expect(deletePhotoRemote).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(PROFILE_PHOTO_DELETE_KEY)).toBeNull();
  });

  it("로그인 · 저장 동의가 없으면 서버와 주고받지 않는다", async () => {
    signInAs("sub-a", { consent: false });
    choosePhoto(IMG, new Date(AT));
    await syncPhoto({ ...DEFAULT_PROFILE_CARD, photoAt: AT });
    expect(putPhotoRemote).not.toHaveBeenCalled();
  });

  it("로그아웃 · 탈퇴하면 이 기기 사본을 지운다 — 공용 기기에 사진이 남지 않게", () => {
    choosePhoto(IMG, new Date(AT));
    removePhoto();
    choosePhoto(IMG, new Date(AT));
    clearDeviceRecords();
    expect(window.localStorage.getItem(PROFILE_PHOTO_KEY)).toBeNull();
    expect(window.localStorage.getItem(PROFILE_PHOTO_DELETE_KEY)).toBeNull();
  });
});

describe("프로필 동그라미", () => {
  it("카드가 가리키는 사진이 이 기기에 있으면 사진이 동그라미를 채운다", () => {
    window.localStorage.setItem(PROFILE_PHOTO_KEY, JSON.stringify({ at: AT, image: IMG, uploaded: true }));
    render(<ProfileAvatar card={{ ...DEFAULT_PROFILE_CARD, photoAt: AT }} size="lg" />);
    expect(screen.getByTestId("profile-photo").getAttribute("src")).toBe(`data:image/jpeg;base64,${IMG}`);
  });

  it("사진이 없거나(photoAt 없음) 다른 사진이면 그림", () => {
    window.localStorage.setItem(PROFILE_PHOTO_KEY, JSON.stringify({ at: "2026-11-01T00:00:00.000Z", image: IMG, uploaded: true }));
    const { rerender } = render(<ProfileAvatar card={DEFAULT_PROFILE_CARD} size="lg" />);
    expect(screen.queryByTestId("profile-photo")).toBeNull();
    rerender(<ProfileAvatar card={{ ...DEFAULT_PROFILE_CARD, photoAt: AT }} size="lg" />);
    expect(screen.queryByTestId("profile-photo")).toBeNull();
  });
});

describe("꾸미기 창 — 사진 칸", () => {
  function 창(photo: string | null) {
    const onSave = vi.fn();
    render(
      <ProfileSheet card={DEFAULT_PROFILE_CARD} photo={photo} defaultName="익산 사는 대학생" earnedBadges={[]} onSave={onSave} onClose={() => {}} />
    );
    return onSave;
  }

  it("그림 칸 맨 앞에 [앨범에서] [사진 찍기] — 앨범은 사진 한 장, 사진 찍기는 카메라를 바로 연다", () => {
    창(null);
    const group = screen.getByRole("group", { name: /프로필 그림/ });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["앨범에서 사진 고르기", "사진 찍기"]);
    const album = screen.getByTestId("photo-album-input");
    expect(album.getAttribute("accept")).toBe("image/*");
    expect(album.hasAttribute("multiple")).toBe(false);
    expect(screen.getByTestId("photo-camera-input").getAttribute("capture")).toBe("user");
  });

  it("사진이 있으면 '사진 지우기' — 누르고 [저장]하면 지움을 넘긴다", async () => {
    const user = userEvent.setup();
    const onSave = 창(IMG);
    expect(screen.getByRole("button", { name: "앨범에서 사진 고르기" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "사진 지우기" }));
    expect(screen.queryByRole("button", { name: "사진 지우기" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][1]).toEqual({ kind: "remove" });
  });

  it("사진이 있을 때 그림을 고르면 그림으로 — [저장]하면 사진을 지운다", async () => {
    const user = userEvent.setup();
    const onSave = 창(IMG);
    await user.click(screen.getAllByRole("radio")[1]);
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][1]).toEqual({ kind: "remove" });
  });

  it("사진을 건드리지 않으면 그대로(null)", async () => {
    const user = userEvent.setup();
    const onSave = 창(IMG);
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][1]).toBeNull();
  });

  it("고른 파일이 있으면 '사진 맞추기' 화면 — 다시 고르기 · 완료 · 위치 정보 안내", async () => {
    창(null);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg", { type: "image/jpeg" });
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    await act(async () => {
      await userEvent.upload(screen.getByTestId("photo-album-input"), file);
    });
    const dialog = screen.getByRole("dialog", { name: "사진 맞추기" });
    expect(within(dialog).getByRole("button", { name: "다시 고르기" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "완료" })).toBeTruthy();
    expect(within(dialog).getByRole("slider", { name: "크기" })).toBeTruthy();
    expect(within(dialog).getByText("작게 줄여 저장하고, 사진 속 위치 정보는 지워요")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog", { name: "사진 맞추기" })).toBeNull();
  });
});
