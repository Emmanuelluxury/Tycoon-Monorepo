/**
 * Secure Hero Navigation Hook
 * 
 * Provides rate-limited, validated navigation with error handling.
 * Prevents rapid-click abuse and ensures only valid routes are accessible.
 * 
 * SW-FE-001: Security hardening review
 */

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { sanitizeError, isRecoverableError } from "@/lib/errors";
import {
  HERO_RATE_LIMIT,
  HERO_NAVIGATION,
  HERO_ANALYTICS_EVENTS,
  isValidNavDestination,
  isValidAnalyticsEvent,
} from "@/lib/hero/constants";

interface NavError {
  hasError: boolean;
  message: string;
}

/**
 * Hook for secure, rate-limited navigation in hero section
 * Validates destinations, tracks events, and handles errors safely
 */
export function useHeroNavigation() {
  const router = useRouter();
  const lastNavTimeRef = useRef<number>(0);

  /**
   * Check if navigation is rate-limited (debounced)
   * Returns false if click happened within debounce window
   */
  const isNotRateLimited = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastNav = now - lastNavTimeRef.current;
    const isAllowed = timeSinceLastNav >= HERO_RATE_LIMIT.debounceMs;

    if (isAllowed) {
      lastNavTimeRef.current = now;
    }

    return isAllowed;
  }, []);

  /**
   * Navigate with security validation and error handling
   * @param eventName - Analytics event name (must be in HERO_ANALYTICS_EVENTS)
   * @param destination - Route to navigate to (must be in HERO_NAVIGATION)
   * @returns Error state if navigation fails, undefined on success
   */
  const navigateSafely = useCallback(
    (
      eventName: string,
      destination: string,
    ): NavError | undefined => {
      try {
        // Rate limiting check
        if (!isNotRateLimited()) {
          return {
            hasError: true,
            message: "Please wait before clicking again.",
          };
        }

        // Validate event name is in allowed list
        if (!isValidAnalyticsEvent(eventName)) {
          console.warn(
            `[Security] Invalid analytics event attempted: ${eventName}`,
          );
          return {
            hasError: true,
            message: "Invalid action. Please try again.",
          };
        }

        // Validate destination is in allowed routes
        if (!isValidNavDestination(destination)) {
          console.warn(
            `[Security] Invalid navigation destination attempted: ${destination}`,
          );
          return {
            hasError: true,
            message: "Invalid destination. Please try again.",
          };
        }

        // Track the analytics event with safe payload
        track(eventName as any, {
          route: "/",
          destination,
        });

        // Perform navigation
        router.push(destination);
        return undefined;
      } catch (err) {
        // Sanitize error to prevent PII/token leakage
        const sanitized = sanitizeError(err);

        // Determine if error is recoverable
        const isRecoverable = isRecoverableError(err);
        const errorMessage = sanitized.userMessage || "An unexpected error occurred";

        return {
          hasError: true,
          message: isRecoverable ? errorMessage : "Unable to navigate. Please refresh and try again.",
        };
      }
    },
    [isNotRateLimited, router],
  );

  return {
    navigateSafely,
  };
}
