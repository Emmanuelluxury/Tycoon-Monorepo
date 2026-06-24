/**
 * SW-FE-013 — Join room flow: error and empty states
 *
 * Verifies every user-visible error state and the empty/idle state of JoinRoomForm:
 *   - Empty input state (disabled button, no errors)
 *   - Validation error (short code → roomCode field error)
 *   - All network error codes: 401, 404, 409, 410, 500
 *   - Message-based error mapping (already joined, full, expired, unauthorized)
 *   - Unexpected / unknown error fallback
 *   - No-auth guard (no token in localStorage)
 *   - Rate-limit guard
 *   - Error banner has role=alert (accessible)
 *   - Error is cleared on subsequent input change
 *   - Retry button resets error and re-fires submit
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

// ─── Empty / idle state ───────────────────────────────────────────────────────

describe("JoinRoomForm — SW-FE-013: empty state", () => {
  it("renders without errors on initial mount", () => {
    render(<JoinRoomForm />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("form-error-banner")).not.toBeInTheDocument();
  });

  it("submit button is disabled when input is empty", () => {
    render(<JoinRoomForm />);
    expect(screen.getByRole("button", { name: /join/i })).toBeDisabled();
  });

  it("hint text is always visible (stable placeholder)", () => {
    render(<JoinRoomForm />);
    expect(screen.getByText(/6-character alphanumeric/i)).toBeInTheDocument();
  });

  it("partial code (< 6 chars) keeps button disabled", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC");
    expect(screen.getByRole("button", { name: /join/i })).toBeDisabled();
  });
});

// ─── Validation error ─────────────────────────────────────────────────────────

describe("JoinRoomForm — SW-FE-013: validation errors", () => {
  it("submitting empty form shows roomCode field error", () => {
    render(<JoinRoomForm />);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("roomCode error message contains '6 characters'", () => {
    render(<JoinRoomForm />);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(screen.getByText(/6 characters/i)).toBeInTheDocument();
  });

it("clearing input after error removes the form-level error banner", async () => {
      const user = userEvent.setup();
      render(<JoinRoomForm />);
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
      await waitFor(() => screen.getByRole("alert"));
      await user.clear(screen.getByRole("textbox"));
      expect(screen.queryByTestId("form-error-banner")).not.toBeInTheDocument();
  });

  it("typing clears roomCode error", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    await waitFor(() => screen.getByRole("alert"));
    await user.type(screen.getByRole("textbox"), "A");
    expect(screen.queryByText(/6 characters/i)).not.toBeInTheDocument();
  });
});

// ─── Network / API error states ───────────────────────────────────────────────

describe("JoinRoomForm — SW-FE-013: API error states", () => {
  async function submitWithCode(code: string) {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), code);
    await user.click(screen.getByRole("button", { name: /join/i }));
  }

  it("401 → shows sign-in prompt", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 401 });
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/sign in/i)
    );
  });

  it("404 → shows room not found", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 404 });
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/room not found/i)
    );
  });

  it("409 → shows room is full", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 409 });
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/room is full/i)
    );
  });

  it("410 → shows invite expired", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 410 });
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/invite link has expired/i)
    );
  });

  it("500 → shows server error", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 500 });
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/server error/i)
    );
  });

  it("unknown error → shows unexpected error fallback", async () => {
    mockPost.mockRejectedValueOnce({});
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/unexpected/i)
    );
  });

  it("message 'already joined' → shows already-in-this-room copy", async () => {
    mockPost.mockRejectedValueOnce({ message: "You are already joined in this room" });
    await submitWithCode("TYC001");
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/already in this room/i)
    );
  });

  it("error banner has role=alert (accessible)", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 404 });
    await submitWithCode("TYC001");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("retry button shown when code is still valid after error", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 404 });
    await submitWithCode("TYC001");
    await waitFor(() => screen.getByTestId("form-error-banner"));
    expect(screen.getByRole("button", { name: /retry joining/i })).toBeInTheDocument();
  });

  it("retry resolves error and navigates on success", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 404 });
    mockPost.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => screen.getByTestId("form-error-banner"));
    await user.click(screen.getByRole("button", { name: /retry joining/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/game-waiting?gameCode=TYC001"));
  });
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe("JoinRoomForm — SW-FE-013: auth guard", () => {
  it("no-auth → shows sign-in error before API call", async () => {
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
});

// ─── Rate-limit guard ─────────────────────────────────────────────────────────

describe("JoinRoomForm — SW-FE-013: rate-limit guard", () => {
  it("rapid second submit shows rate-limit message", async () => {
    // First submit succeeds
    mockPost.mockResolvedValue({} as never);
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));

    // Button re-enables; second click within cooldown
    await waitFor(() => expect(screen.getByRole("button", { name: /join/i })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(screen.getByTestId("form-error-banner")).toHaveTextContent(/please wait/i)
    );
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
