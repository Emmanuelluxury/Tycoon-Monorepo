"use client";

/**
 * SW-FE-001: Privacy-safe telemetry hook for the landing hero.
 *
 * Design principles:
 *   - No PII collected (no IP, no user ID, no fingerprinting).
 *   - No external analytics SDK — events are dispatched on `window` so any
 *     first-party collector (e.g. /api/telemetry endpoint) can listen.
 *   - Disabled server-side (SSR-safe).
 *   - Feature-flagged via NEXT_PUBLIC_TELEMETRY_ENABLED env var.
 *   - All event names are string-literal typed to prevent typos.
 *   - Elapsed time (ms since page load) only — no wall-clock timestamps to avoid PII.
 */

import { useCallback } from "react";

/**
 * Hero telemetry event names.
 * Strictly typed to prevent accidental event name typos.
 */
export type HeroEventName =
  | "hero_view"
  | "hero_cta_click"
  | "hero_join_room_click"
  | "hero_challenge_ai_click"
  | "hero_multiplayer_click"
  | "hero_error_displayed";

/**
 * Payload structure for telemetry events.
 * Designed to be minimal and privacy-safe.
 */
export interface HeroTelemetryEvent {
  name: HeroEventName;
  /** Milliseconds since page load — no wall-clock timestamp to avoid PII */
  elapsed: number;
  /** Optional error type for hero_error_displayed events */
  errorType?: "navigation_error" | "rate_limit_exceeded" | "validation_failed";
}

/**
 * Check if telemetry is enabled via environment variable.
 * Returns false on server-side to prevent SSR errors.
 */
function isTelemetryEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "true"
  );
}

/** Track page load time for elapsed calculations */
let pageLoadTime: number | null = null;

/**
 * Get elapsed time since page load.
 * Cached to ensure consistent baseline across all events on the same page.
 */
function getElapsed(): number {
  if (typeof window === "undefined") return 0;
  if (pageLoadTime === null) {
    pageLoadTime = performance.now();
  }
  return Math.round(performance.now() - pageLoadTime);
}

/**
 * Dispatch a telemetry event.
 * Events are sent via CustomEvent on window for first-party collection.
 *
 * @param name - Event name (strictly typed)
 * @param errorType - Optional error type for error events
 */
export function trackHeroEvent(
  name: HeroEventName,
  errorType?: HeroTelemetryEvent["errorType"],
): void {
  if (!isTelemetryEnabled()) return;

  const payload: HeroTelemetryEvent = {
    name,
    elapsed: getElapsed(),
    ...(errorType && { errorType }),
  };

  // Dispatch custom event so first-party collectors can listen
  window.dispatchEvent(
    new CustomEvent("tycoon:telemetry", {
      detail: payload,
      bubbles: false,
      cancelable: false,
    }),
  );
}

/**
 * React hook for hero telemetry.
 * Returns stable callback references via useCallback.
 *
 * @returns Object with fire() and fireError() methods
 */
export function useHeroTelemetry() {
  const fire = useCallback((name: HeroEventName) => {
    trackHeroEvent(name);
  }, []);

  const fireError = useCallback(
    (errorType: HeroTelemetryEvent["errorType"]) => {
      trackHeroEvent("hero_error_displayed", errorType);
    },
    [],
  );

  return {
    fire,
    fireError,
  };
}
