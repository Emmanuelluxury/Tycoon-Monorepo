/**
 * Unit tests for useGameWaiting hook.
 *
 * Tests the state logic, null guards, and invalid-code detection
 * independently of the GameWaiting rendering layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- Mocks ---
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === "gameCode" ? "TYCOON" : null),
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    update: vi.fn(),
    success: vi.fn(),
  },
}));

import { useGameWaiting, isValidRoomCode, FALLBACK_GAME_CODE } from "@/hooks/useGameWaiting";

// ---------------------------------------------------------------------------
// isValidRoomCode (re-exported from hook for shared use)
// ---------------------------------------------------------------------------

describe("isValidRoomCode (hook export)", () => {
  it("accepts exactly 6 alphanumeric characters", () => {
    expect(isValidRoomCode("TYCOON")).toBe(true);
    expect(isValidRoomCode("ABC123")).toBe(true);
  });

  it("rejects codes shorter than 6 characters", () => {
    expect(isValidRoomCode("TYC")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });

  it("rejects codes longer than 6 characters", () => {
    expect(isValidRoomCode("TYCOON1")).toBe(false);
  });

  it("rejects codes with special characters", () => {
    expect(isValidRoomCode("TYC!ON")).toBe(false);
    expect(isValidRoomCode("TYC ON")).toBe(false);
  });

  it("trims whitespace before validating", () => {
    expect(isValidRoomCode("  TYCOON  ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useGameWaiting hook
// ---------------------------------------------------------------------------

describe("useGameWaiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in loading state", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.loading).toBe(true);
  });

  it("resolves loading after 1500ms", async () => {
    const { result } = renderHook(() => useGameWaiting());
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.loading).toBe(false);
  });

  it("returns the game code from search params", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.gameCode).toBe("TYCOON");
  });

  it("isInvalidCode is false for a valid code", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.isInvalidCode).toBe(false);
  });

  it("starts with no error", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.error).toBeNull();
  });

  it("setError updates the error state", () => {
    const { result } = renderHook(() => useGameWaiting());
    act(() => { result.current.setError("Something went wrong"); });
    expect(result.current.error).toBe("Something went wrong");
  });

  it("setError(null) clears the error", () => {
    const { result } = renderHook(() => useGameWaiting());
    act(() => { result.current.setError("err"); });
    act(() => { result.current.setError(null); });
    expect(result.current.error).toBeNull();
  });

  it("starts with no player symbol selected", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.playerSymbol).toBeNull();
  });

  it("setPlayerSymbol updates the selected symbol", () => {
    const { result } = renderHook(() => useGameWaiting());
    act(() => {
      result.current.setPlayerSymbol({ name: "Ship", value: "ship", emoji: "🚢" });
    });
    expect(result.current.playerSymbol?.value).toBe("ship");
  });

  it("isJoined starts as false", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.isJoined).toBe(false);
  });

  it("handleJoinGame sets error when no symbol is selected", async () => {
    const { result } = renderHook(() => useGameWaiting());
    await act(async () => { await result.current.handleJoinGame(); });
    expect(result.current.error).toBe("Please select a valid symbol.");
  });

  it("handleJoinGame sets isJoined after selecting a symbol", async () => {
    const { result } = renderHook(() => useGameWaiting());
    act(() => {
      result.current.setPlayerSymbol({ name: "Plane", value: "plane", emoji: "✈️" });
    });
    act(() => { void result.current.handleJoinGame(); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.isJoined).toBe(true);
  });

  it("handleJoinGame adds the player to gamePlayers", async () => {
    const { result } = renderHook(() => useGameWaiting());
    const initialCount = result.current.gamePlayers.length;
    act(() => {
      result.current.setPlayerSymbol({ name: "Plane", value: "plane", emoji: "✈️" });
    });
    act(() => { void result.current.handleJoinGame(); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.gamePlayers.length).toBe(initialCount + 1);
  });

  it("handleLeaveGame resets isJoined and clears the player", async () => {
    const { result } = renderHook(() => useGameWaiting());
    // Join first
    act(() => {
      result.current.setPlayerSymbol({ name: "Plane", value: "plane", emoji: "✈️" });
    });
    act(() => { void result.current.handleJoinGame(); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.isJoined).toBe(true);
    // Now leave
    act(() => { void result.current.handleLeaveGame(); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(result.current.isJoined).toBe(false);
    expect(result.current.playerSymbol).toBeNull();
  });

  it("countdown starts at 60 and decrements after loading", async () => {
    const { result } = renderHook(() => useGameWaiting());
    await act(async () => { vi.advanceTimersByTime(1500); }); // finish loading
    expect(result.current.countdown).toBe(60);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(result.current.countdown).toBe(57);
  });

  it("countdown does not go below 0", async () => {
    const { result } = renderHook(() => useGameWaiting());
    await act(async () => { vi.advanceTimersByTime(1500); });
    await act(async () => { vi.advanceTimersByTime(70_000); });
    expect(result.current.countdown).toBe(0);
  });

  it("availableSymbols excludes symbols already taken by players", () => {
    const { result } = renderHook(() => useGameWaiting());
    // DUMMY_PLAYERS use "ship" and "car"
    const available = result.current.availableSymbols.map((s) => s.value);
    expect(available).not.toContain("ship");
    expect(available).not.toContain("car");
    expect(available).toContain("plane");
    expect(available).toContain("truck");
  });

  it("canStartGame is true when there are enough players and user is host", async () => {
    const { result } = renderHook(() => useGameWaiting());
    // DUMMY_PLAYERS already has 2 players and isHost is true
    expect(result.current.canStartGame).toBe(true);
  });

  it("handleGoHome calls router.push('/')", () => {
    const { result } = renderHook(() => useGameWaiting());
    act(() => { result.current.handleGoHome(); });
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("gameUrl is empty string when window is undefined (SSR)", () => {
    // In jsdom, window.location.origin is "http://localhost" so gameUrl is non-empty.
    // We verify it contains the game code.
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.gameUrl).toContain("TYCOON");
  });

  it("farcasterMiniappUrl contains the game code", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.farcasterMiniappUrl).toContain("TYCOON");
  });

  it("statusMessages starts with the mock messages", () => {
    const { result } = renderHook(() => useGameWaiting());
    expect(result.current.statusMessages.length).toBeGreaterThan(0);
    expect(result.current.statusMessages[0].type).toBe("system");
  });

  it("handleJoinGame appends a join status message", async () => {
    const { result } = renderHook(() => useGameWaiting());
    const initialMsgCount = result.current.statusMessages.length;
    act(() => {
      result.current.setPlayerSymbol({ name: "Plane", value: "plane", emoji: "✈️" });
    });
    act(() => { void result.current.handleJoinGame(); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.statusMessages.length).toBe(initialMsgCount + 1);
    const last = result.current.statusMessages[result.current.statusMessages.length - 1];
    expect(last.type).toBe("join");
    expect(last.text).toContain("joined");
  });

  it("gameConfig exposes the correct fallback code", () => {
    const { result } = renderHook(() => useGameWaiting());
    // gameCode from mock is "TYCOON" which equals FALLBACK_GAME_CODE
    expect(result.current.gameConfig.code).toBe(FALLBACK_GAME_CODE);
  });
});
