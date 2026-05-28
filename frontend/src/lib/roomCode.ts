/**
 * Shared room-code validation utilities.
 * Used by both JoinRoomForm and GameWaitingClient to enforce consistent rules.
 */

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_REGEX = /^[A-Za-z0-9]{6}$/;

/**
 * Returns true when `value` is a valid room code:
 * exactly 6 alphanumeric characters (case-insensitive).
 */
export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_REGEX.test(value.trim());
}

/**
 * Normalises a raw room code to uppercase, trimmed.
 * Does NOT validate — call isValidRoomCode first.
 */
export function normaliseRoomCode(value: string): string {
  return value.trim().toUpperCase();
}
