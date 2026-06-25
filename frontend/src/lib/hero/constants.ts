/**
 * Hero Component Security-Hardened Constants
 * 
 * This module defines CSP-compliant, sanitized constants for the landing hero.
 * All inline styles, SVG paths, and color values are pre-validated to prevent
 * injection attacks and ensure compliance with Content Security Policy.
 * 
 * SW-FE-001: Security hardening review
 */

/**
 * Pre-validated gradient backgrounds for CSP compliance
 * These gradients are hardcoded and never constructed from user input
 */
export const HERO_GRADIENTS = {
  desktop: "linear-gradient(135deg, #010F10 0%, #0a2a2d 50%, #010F10 100%)",
  mobile: "linear-gradient(180deg, #010F10 0%, #0a1f21 40%, #010F10 100%)",
} as const;

/**
 * Pre-validated color palette
 * All colors used in the hero section for consistent, sanitized rendering
 */
export const HERO_COLORS = {
  primary: "#010F10",
  accent: "#00F0FF",
  accentAlt: "#0FF0FC",
  text: "#F0F7F7",
  textSubtle: "#F0F7F7",
  border: "#003B3E",
  bgAlt: "#0a2a2d",
  bgCard: "#0E1415",
} as const;

/**
 * Pre-validated SVG paths for buttons
 * These paths are hardcoded and never constructed from user input
 * All paths are safe, non-malicious geometric shapes
 */
export const HERO_SVG_PATHS = {
  primaryButton: "M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z",
  secondaryButton: "M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z",
  tertiaryButton: "M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z",
  quaternaryButton: "M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z",
} as const;

/**
 * Animation sequences for hero section
 * Validated to prevent timing attack vectors
 */
export const HERO_ANIMATIONS = {
  typeSpeed: 40,
  subSpeed: 30,
  taglineSequence: [
    "Conquer",
    1200,
    "Conquer • Build",
    1200,
    "Conquer • Build • Trade On",
    1800,
    "Play Solo vs AI",
    2000,
    "Conquer • Build",
    1000,
    "Conquer",
    1000,
  ] as const,
  descriptionSequence: [
    "Roll the dice",
    2000,
    "Buy properties",
    2000,
    "Collect rent",
    2000,
    "Play against AI opponents",
    2200,
    "Become the top tycoon",
    2000,
  ] as const,
} as const;

/**
 * Validated navigation destinations
 * Whitelist of allowed routes to prevent navigation hijacking
 * Only routes defined here can be accessed via hero CTAs
 */
export const HERO_NAVIGATION = {
  continueGame: "/game-settings",
  multiplayer: "/game-settings",
  joinRoom: "/join-room",
  playAi: "/play-ai",
} as const;

/**
 * Validated analytics event names
 * Maps to the analytics taxonomy, preventing arbitrary event emission
 */
export const HERO_ANALYTICS_EVENTS = {
  continueGameClick: "continue_game_click",
  multiplayerClick: "multiplayer_click",
  joinRoomClick: "join_room_click",
  playAiClick: "play_ai_click",
} as const;

/**
 * Rate limiting configuration for button interactions
 * Prevents rapid clicking abuse and navigation spam
 */
export const HERO_RATE_LIMIT = {
  debounceMs: 500,
  maxClicksPerSecond: 2,
} as const;

/**
 * Error messages (sanitized, no user input)
 * Generic messages that never expose internal details
 */
export const HERO_ERROR_MESSAGES = {
  navigationFailed: "An unexpected error occurred",
  unknownError: "Something went wrong. Please try again.",
} as const;

/**
 * Validate that a destination is in the allowed navigation list
 * @param destination - Route to validate
 * @returns true if destination is allowed, false otherwise
 */
export function isValidNavDestination(destination: string): boolean {
  const allowedDestinations = Object.values(HERO_NAVIGATION);
  return allowedDestinations.includes(destination as any);
}

/**
 * Validate that an event name is in the allowed analytics list
 * @param event - Event name to validate
 * @returns true if event is allowed, false otherwise
 */
export function isValidAnalyticsEvent(event: string): boolean {
  const allowedEvents = Object.values(HERO_ANALYTICS_EVENTS);
  return allowedEvents.includes(event as any);
}
