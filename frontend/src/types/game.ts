/**
 * Shared game types used across the join-room / game-waiting flow.
 * Centralised here so components, hooks, and tests all import from one place.
 */

/** A selectable player token / piece. */
export interface PlayerSymbol {
  name: string;
  value: string;
  emoji: string;
}

/** A lobby status-feed message. */
export interface StatusMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: "info" | "join" | "leave" | "system";
}

/** A player currently in the lobby. */
export interface GamePlayer {
  /** On-chain address or unique identifier. */
  address: string;
  username: string;
  /** Token / piece value (e.g. "ship", "car"). */
  symbol: string;
}

/** Minimal game configuration surfaced in the lobby. */
export interface GameConfig {
  code: string;
  maxPlayers: number;
  stakeLabel: string;
  stakeValue: bigint;
}
