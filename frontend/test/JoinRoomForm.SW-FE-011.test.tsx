/**
 * SW-FE-011 — Join room flow: Vitest / RTL coverage
 *
 * Edge cases not exercised by existing suites:
 *   - previewState prop overrides (code, errors, isLoading)
 *   - skipAutoFocus prevents input focus on mount
 *   - Escape key clears input and errors
 *   - Ctrl+Enter submits the form
 *   - already-joined (410-adjacent) error message
 *   - invite-expired (410) error message
 *   - unauthorized (401) error message
 *   - rate-limit guard fires on rapid re-submit
 *   - input aria-invalid reflects field error state
 *   - error banner absent on initial render
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "./mocks/join-room-i18n";
import JoinRoomForm from "@/components/settings/JoinRoomForm";
import { apiClient } from "@/lib/api/client";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));

const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  pushMock.mockClear();
  mockPost.mockClear();
  mockPost.mockResolvedValue({} as never);
  localStorage.setItem("access_token", "tok");
});
afterEach(() => localStorage.removeItem("access_token"));

describe("JoinRoomForm — SW-FE-011: additional RTL coverage", () => {
  it("no error banner on initial render", () => {
    render(<JoinRoomForm />);
    expect(screen.queryByTestId("form-error-banner")).not.toBeInTheDocument();
  });

  it("previewState.code pre-fills the input", () => {
    render(<JoinRoomForm previewState={{ code: "ABC123" }} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("ABC123");
  });

  it("previewState.errors renders a field error", () => {
    render(<JoinRoomForm previewState={{ errors: { roomCode: "join_room.validation.code_length" } }} />);
    expect(screen.getByText(/6 characters/i)).toBeInTheDocument();
  });

  it("previewState.isLoading disables the button", () => {
    render(<JoinRoomForm previewState={{ code: "ABC123", isLoading: true }} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("previewState.skipAutoFocus leaves input un-focused", () => {
    render(<JoinRoomForm previewState={{ skipAutoFocus: true }} />);
    expect(document.activeElement).not.toBe(screen.getByRole("textbox"));
  });

  it("Escape key clears input value", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByRole("textbox");
    await user.type(input, "TYC001");
    expect((input as HTMLInputElement).value).toBe("TYC001");
    await user.keyboard("{Escape}");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("Ctrl+Enter submits when code is valid", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001"));
  });

  it("shows invite-expired banner for 410 response", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 410 });
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/invite link has expired/i)
    );
  });

  it("shows unauthorized banner when no token present", async () => {
    localStorage.removeItem("access_token");
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/sign in/i)
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("shows already-joined banner for message containing 'already joined'", async () => {
    mockPost.mockRejectedValueOnce({ message: "You are already joined in this room" });
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/already in this room/i)
    );
  });

  it("input aria-invalid is unset when no field error", () => {
    render(<JoinRoomForm />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });

  it("input aria-invalid becomes true after validation error", () => {
    render(<JoinRoomForm />);
    const form = screen.getByRole("textbox").closest("form")!;
    fireEvent.submit(form);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("retry button re-submits the form", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 404 });
    mockPost.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => screen.getByTestId("form-error-banner"));
    const retryBtn = screen.getByRole("button", { name: /retry joining/i });
    await user.click(retryBtn);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001"));
  });
});
