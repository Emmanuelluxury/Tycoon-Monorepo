/**
 * useGameWaiting
 *
 * Encapsulates all runtime state and side-effects for the game-waiting lobby.
 * Extracted from GameWaiting.tsx so the logic is independently testable and
 * the component stays a pure rendering layer.
 *
 * TypeScript strict-mode compliant:
 *  - All nullable paths are explicitly guarded.
 *  - mountedRef prevents state updates on unmounted components.
 *  - Stale closures are avoided by capturing values before async gaps.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import type { GamePlayer, GameConfig, PlayerSymbol, StatusMessage } from "@/types/game";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SYMBOLS: PlayerSymbol[] = [
  { name: "Ship", value: "ship", emoji: "🚢" },
  { name: "Car", value: "car", emoji: "🚗" },
  { name: "Plane", value: "plane", emoji: "✈️" },
  { name: "Truck", value: "truck", emoji: "🚚" },
];

export const FALLBACK_GAME_CODE = "TYCOON";
export const COPY_FEEDBACK_MS = 2000;
export const MOCK_AUTO_START_SECONDS = 60;
export const MIN_PLAYERS_TO_START = 2;

const MOCK_STATUS_MESSAGES: StatusMessage[] = [
  { id: "1", text: "Lobby created. Waiting for players...", timestamp: new Date(), type: "system" },
  { id: "2", text: "Player1 joined the lobby", timestamp: new Date(), type: "join" },
  { id: "3", text: "Player2 joined the lobby", timestamp: new Date(), type: "join" },
];

const DUMMY_PLAYERS: GamePlayer[] = [
  { address: "0x123...abc", username: "Player1", symbol: "ship" },
  { address: "0x456...def", username: "Player2", symbol: "car" },
];

export const DUMMY_GAME_CONFIG: GameConfig = {
  code: FALLBACK_GAME_CODE,
  maxPlayers: 4,
  stakeLabel: "10 USDC",
  stakeValue: BigInt("10000000"),
};

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseGameWaitingReturn {
  // Derived from URL
  gameCode: string;
  /** True when the gameCode param is present but fails validation. */
  isInvalidCode: boolean;

  // Loading / error
  loading: boolean;
  error: string | null;
  setError: (msg: string | null) => void;

  // Players
  gamePlayers: GamePlayer[];
  availableSymbols: PlayerSymbol[];

  // Player state
  playerSymbol: PlayerSymbol | null;
  setPlayerSymbol: (s: PlayerSymbol | null) => void;
  isJoined: boolean;
  isHost: boolean;
  actionLoading: boolean;

  // Countdown
  countdown: number;

  // Status feed
  statusMessages: StatusMessage[];

  // Game config
  gameConfig: GameConfig;

  // Share URLs
  gameUrl: string;
  farcasterMiniappUrl: string;
  telegramShareUrl: string;
  twitterShareUrl: string;
  farcasterShareUrl: string;

  // Copy feedback
  copySuccess: string | null;
  copySuccessFarcaster: string | null;

  // Derived
  canStartGame: boolean;

  // Handlers
  handleCopyLink: () => Promise<void>;
  handleCopyFarcasterLink: () => Promise<void>;
  handleJoinGame: () => Promise<void>;
  handleLeaveGame: () => Promise<void>;
  handleStartGame: () => void;
  handleGoHome: () => void;
}

// ---------------------------------------------------------------------------
// Validation helper (mirrors JoinRoomForm.isValidRoomCode)
// ---------------------------------------------------------------------------

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_REGEX = /^[A-Za-z0-9]+$/;

export function isValidRoomCode(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === ROOM_CODE_LENGTH && ROOM_CODE_REGEX.test(trimmed);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameWaiting(): UseGameWaitingReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  // searchParams.get() returns null when the param is absent — guard with fallback.
  const rawParam = searchParams.get("gameCode") ?? "";
  const normalised = rawParam.trim().toUpperCase();

  // Detect an invalid (non-empty but malformed) code so the UI can warn the user.
  const isInvalidCode = normalised.length > 0 && !isValidRoomCode(normalised);
  const gameCode = isValidRoomCode(normalised) ? normalised : FALLBACK_GAME_CODE;

  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>(DUMMY_PLAYERS);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copySuccessFarcaster, setCopySuccessFarcaster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdown, setCountdown] = useState(MOCK_AUTO_START_SECONDS);
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>(MOCK_STATUS_MESSAGES);

  // isHost is a constant for now (mock); will come from auth context when real auth lands.
  const isHost = true;

  // Tracks mount status so async callbacks never update unmounted state.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading(false);
    }, 1500);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Countdown — only starts after the initial loading phase resolves.
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const availableSymbols = useMemo(() => {
    const taken = new Set(gamePlayers.map((p) => p.symbol));
    return SYMBOLS.filter((s) => !taken.has(s.value));
  }, [gamePlayers]);

  const origin = useMemo(() => {
    try {
      if (typeof window === "undefined") return "";
      return window.location?.origin ?? "";
    } catch {
      return "";
    }
  }, []);

  const gameUrl = useMemo(
    () => (origin ? `${origin}/game-waiting?gameCode=${encodeURIComponent(gameCode)}` : ""),
    [origin, gameCode],
  );

  const farcasterMiniappUrl = useMemo(
    () =>
      `https://farcaster.xyz/miniapps/bylqDd2BdAR5/tycoon/game-waiting?gameCode=${encodeURIComponent(gameCode)}`,
    [gameCode],
  );

  const shareText = useMemo(
    () =>
      gameUrl
        ? `Join my Tycoon game! Code: ${gameCode}. Waiting room: ${gameUrl}`
        : `Join my Tycoon game! Code: ${gameCode}.`,
    [gameCode, gameUrl],
  );

  const farcasterShareText = useMemo(
    () => `Join my Tycoon game! Code: ${gameCode}.`,
    [gameCode],
  );

  const telegramShareUrl = useMemo(
    () =>
      gameUrl
        ? `https://t.me/share/url?url=${encodeURIComponent(gameUrl)}&text=${encodeURIComponent(shareText)}`
        : "",
    [gameUrl, shareText],
  );

  const twitterShareUrl = useMemo(
    () => `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    [shareText],
  );

  const farcasterShareUrl = useMemo(
    () =>
      `https://warpcast.com/~/compose?text=${encodeURIComponent(farcasterShareText)}&embeds[]=${encodeURIComponent(farcasterMiniappUrl)}`,
    [farcasterShareText, farcasterMiniappUrl],
  );

  const canStartGame = useMemo(
    () => gamePlayers.length >= MIN_PLAYERS_TO_START && isHost,
    [gamePlayers.length, isHost],
  );

  // ---------------------------------------------------------------------------
  // Clipboard helper — prefers navigator.clipboard, falls back to execCommand.
  // ---------------------------------------------------------------------------
  async function copyToClipboard(text: string): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Legacy fallback (deprecated but still needed for some environments).
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand("copy");
    document.body.removeChild(el);
  }

  const handleCopyLink = useCallback(async () => {
    if (!gameUrl) {
      setError("No shareable URL available.");
      return;
    }
    try {
      await copyToClipboard(gameUrl);
      setCopySuccess("Copied!");
      setTimeout(() => {
        if (mountedRef.current) setCopySuccess(null);
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("copy failed", err);
      setError("Failed to copy link. Try manually selecting the text.");
    }
  }, [gameUrl]);

  const handleCopyFarcasterLink = useCallback(async () => {
    try {
      await copyToClipboard(farcasterMiniappUrl);
      setCopySuccessFarcaster("Farcaster link copied!");
      setTimeout(() => {
        if (mountedRef.current) setCopySuccessFarcaster(null);
      }, COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("copy farcaster failed", err);
      setError("Failed to copy Farcaster link.");
    }
  }, [farcasterMiniappUrl]);

  const handleJoinGame = useCallback(async () => {
    if (!playerSymbol?.value) {
      setError("Please select a valid symbol.");
      return;
    }
    setActionLoading(true);
    const toastId = toast.loading("Joining the lobby...");
    // Capture before the async gap to avoid stale closure.
    const symbolValue = playerSymbol.value;
    setTimeout(() => {
      if (!mountedRef.current) return;
      setIsJoined(true);
      setGamePlayers((prev) => [
        ...prev,
        { address: "0xYOU", username: "You", symbol: symbolValue },
      ]);
      setStatusMessages((prev) => [
        ...prev,
        {
          id: `join-${Date.now()}`,
          text: "You joined the lobby",
          timestamp: new Date(),
          type: "join",
        },
      ]);
      toast.update(toastId, {
        render: "Successfully joined the game!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
      setActionLoading(false);
    }, 1500);
  }, [playerSymbol]);

  const handleLeaveGame = useCallback(async () => {
    setActionLoading(true);
    setTimeout(() => {
      if (!mountedRef.current) return;
      setIsJoined(false);
      setGamePlayers((prev) => prev.filter((p) => p.address !== "0xYOU"));
      setPlayerSymbol(null);
      setActionLoading(false);
    }, 1000);
  }, []);

  const handleStartGame = useCallback(() => {
    if (!canStartGame) return;
    toast.success("Starting game...");
  }, [canStartGame]);

  const handleGoHome = useCallback(() => router.push("/"), [router]);

  return {
    gameCode,
    isInvalidCode,
    loading,
    error,
    setError,
    gamePlayers,
    availableSymbols,
    playerSymbol,
    setPlayerSymbol,
    isJoined,
    isHost,
    actionLoading,
    countdown,
    statusMessages,
    gameConfig: DUMMY_GAME_CONFIG,
    gameUrl,
    farcasterMiniappUrl,
    telegramShareUrl,
    twitterShareUrl,
    farcasterShareUrl,
    copySuccess,
    copySuccessFarcaster,
    canStartGame,
    handleCopyLink,
    handleCopyFarcasterLink,
    handleJoinGame,
    handleLeaveGame,
    handleStartGame,
    handleGoHome,
  };
}
