"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Dices, Gamepad2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useHeroTelemetry } from "@/hooks/useHeroTelemetry";
import { useHeroNavigation } from "@/hooks/useHeroNavigation";
import {
  HERO_GRADIENTS,
  HERO_COLORS,
  HERO_SVG_PATHS,
  HERO_ANIMATIONS,
  HERO_ANALYTICS_EVENTS,
  HERO_NAVIGATION,
} from "@/lib/hero/constants";

interface HeroSectionProps {
  className?: string;
}

interface HeroErrorState {
  hasError: boolean;
  message: string;
  type?: "navigation" | "rate_limit" | "validation";
}

interface HeroEmptyState {
  isEmpty: boolean;
  reason?: "offline" | "loading" | "maintenance";
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Hero Error State Component
 * SW-FE-001: Displays error with retry and home navigation options
 */
function HeroErrorDisplay({
  error,
  onRetry,
}: {
  error: HeroErrorState;
  onRetry: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <section
      aria-label="Hero Error"
      role="alert"
      aria-live="assertive"
      className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 flex items-center justify-center"
      style={{
        backgroundColor: HERO_COLORS.primary,
        background: HERO_GRADIENTS.desktop,
      }}
    >
      <div className="max-w-md w-full px-4 space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" aria-hidden="true" />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-500/20 blur-xl" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-3">
          <p
            className="font-orbitron text-[24px] md:text-[28px] font-[700]"
            style={{ color: HERO_COLORS.accent }}
          >
            Something went wrong
          </p>
          <p
            className="font-dmSans text-[14px] md:text-[16px] leading-relaxed"
            style={{ color: HERO_COLORS.textSubtle }}
          >
            {error.message}
          </p>

          {/* Optional Details Toggle */}
          {error.type && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-2 text-xs mt-3 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: HERO_COLORS.accent }}
            >
              {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
              {showDetails ? "Hide" : "Show"} error code
            </button>
          )}

          {showDetails && error.type && (
            <p
              className="font-mono text-xs p-2 rounded bg-black/20 mt-2"
              style={{ color: HERO_COLORS.accent }}
            >
              {error.type}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={onRetry}
            className="w-full px-6 py-3 rounded-lg font-orbitron font-[700] text-[14px] transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: HERO_COLORS.accent,
              color: HERO_COLORS.primary,
            }}
            aria-label="Try again"
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full px-6 py-3 rounded-lg font-orbitron font-[700] text-[14px] transition-all hover:opacity-90 active:scale-95 border-2"
            style={{
              borderColor: HERO_COLORS.border,
              color: HERO_COLORS.text,
              backgroundColor: "transparent",
            }}
            aria-label="Go to home"
          >
            Go Home
          </button>
        </div>

        {/* Support Link */}
        <p className="text-center text-xs" style={{ color: HERO_COLORS.textSubtle }}>
          Need help?{" "}
          <a
            href="/support"
            className="underline transition-opacity hover:opacity-70"
            style={{ color: HERO_COLORS.accent }}
          >
            Contact support
          </a>
        </p>
      </div>
    </section>
  );
}

/**
 * Hero Empty State Component
 * SW-FE-001: Displays when no game is available or service is unavailable
 */
function HeroEmptyState({
  reason = "offline",
}: {
  reason?: "offline" | "loading" | "maintenance";
}) {
  const messages = {
    offline: {
      title: "Offline",
      description: "Check your connection and try again.",
      hint: "Make sure you're connected to the internet.",
    },
    loading: {
      title: "Loading...",
      description: "Getting things ready for you.",
      hint: "This usually takes a moment.",
    },
    maintenance: {
      title: "Under Maintenance",
      description: "We're making improvements to the game.",
      hint: "Check back soon!",
    },
  };

  const config = messages[reason];

  return (
    <section
      aria-label="Hero Unavailable"
      role="status"
      aria-busy={reason === "loading"}
      className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 flex items-center justify-center"
      style={{
        backgroundColor: HERO_COLORS.primary,
        background: HERO_GRADIENTS.desktop,
      }}
    >
      <div className="max-w-md w-full px-4 space-y-6 text-center">
        {/* Loading/Status Indicator */}
        {reason === "loading" && (
          <div className="flex justify-center gap-2">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: HERO_COLORS.accent, animationDelay: "0ms" }}
            />
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: HERO_COLORS.accent, animationDelay: "150ms" }}
            />
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: HERO_COLORS.accent, animationDelay: "300ms" }}
            />
          </div>
        )}

        {/* Message */}
        <div className="space-y-2">
          <p
            className="font-orbitron text-[24px] md:text-[28px] font-[700]"
            style={{ color: HERO_COLORS.accent }}
          >
            {config.title}
          </p>
          <p
            className="font-dmSans text-[14px] md:text-[16px] leading-relaxed"
            style={{ color: HERO_COLORS.textSubtle }}
          >
            {config.description}
          </p>
          <p
            className="text-xs"
            style={{ color: HERO_COLORS.textSubtle, opacity: 0.7 }}
          >
            {config.hint}
          </p>
        </div>

        {/* Action Button */}
        {reason !== "loading" && (
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 rounded-lg font-orbitron font-[700] text-[14px] transition-all hover:opacity-90 active:scale-95 mt-6"
            style={{
              backgroundColor: HERO_COLORS.accent,
              color: HERO_COLORS.primary,
            }}
            aria-label="Reload page"
          >
            Reload
          </button>
        )}
      </div>
    </section>
  );
}

const HeroSection: React.FC<HeroSectionProps> = ({ className }) => {
  const { fire, fireError } = useHeroTelemetry();
  const { navigateSafely } = useHeroNavigation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [error, setError] = useState<HeroErrorState>({ hasError: false, message: "" });
  const [empty, setEmpty] = useState<HeroEmptyState>({ isEmpty: false });

  // SW-FE-001: Track hero view on mount (once per session)
  useEffect(() => {
    fire("hero_view");
  }, [fire]);

  // SW-FE-001: Secure navigation with validation, rate limiting, and telemetry
  const handleTrackedNavigation = useCallback(
    (event: "continue_game_click" | "multiplayer_click" | "join_room_click" | "challenge_ai_click", destination: string) => {
      // Track CTA click before navigation attempt
      fire("hero_cta_click");

      // Navigate with security validation
      const navError = navigateSafely(event, destination);
      if (navError) {
        // Determine error type for telemetry
        let errorType: "navigation" | "rate_limit" | "validation" = "validation";
        if (navError.message.includes("wait before clicking")) {
          errorType = "rate_limit";
        } else if (navError.message.includes("Invalid destination")) {
          errorType = "navigation";
        }

        fireError(errorType === "rate_limit" ? "rate_limit_exceeded" : "validation_failed");
        setError({ hasError: true, message: navError.message, type: errorType });
      }
    },
    [fire, fireError, navigateSafely],
  );

  // SW-FE-001: Error state — show safe message when navigation fails
  if (error.hasError) {
    return (
      <HeroErrorDisplay
        error={error}
        onRetry={() => {
          setError({ hasError: false, message: "" });
          fire("hero_view");
        }}
      />
    );
  }

  // SW-FE-001: Empty state — show when service is unavailable
  if (empty.isEmpty && empty.reason) {
    return <HeroEmptyState reason={empty.reason} />;
  }

  return (
    <section
      aria-label="Hero"
      className={`z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 ${className || ""}`}
      style={{
        backgroundColor: HERO_COLORS.primary,
      }}
    >
      {/* Background gradient — CSP-compliant pre-validated constant */}
      <div
        aria-hidden="true"
        className="w-full h-full overflow-hidden bg-cover bg-center"
        style={{
          background: HERO_GRADIENTS.desktop,
        }}
      />

      {/* Large Background TYCOON Text — decorative only */}
      <div aria-hidden="true" className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <p className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-1">
          TYCOON
        </p>
      </div>

      <div className="absolute left-0 top-0 z-2 flex h-full w-full flex-col items-center gap-1 bg-transparent lg:justify-center">
        {/* Welcome Message */}
        <div className="mt-20 md:mt-28 lg:mt-0">
          <p
            className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-center"
            style={{
              color: HERO_COLORS.accent,
            }}
          >
            Welcome back, Player!
          </p>
        </div>

        {/* Animated Tagline */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="flex min-h-[30px] md:min-h-[44px] lg:min-h-[56px] justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4"
        >
          <TypeAnimation
            sequence={HERO_ANIMATIONS.taglineSequence}
            wrapper="span"
            speed={HERO_ANIMATIONS.typeSpeed}
            repeat={prefersReducedMotion ? 1 : Infinity}
            preRenderFirstString
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-center block"
            style={{
              color: HERO_COLORS.text,
            }}
          />
        </div>

        {/* Main Title — single h1 on this page */}
        <h1
          data-testid="hero-main-title"
          className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase relative"
          style={{
            color: HERO_COLORS.accentAlt,
          }}
        >
          TYCOON
          <span
            aria-hidden="true"
            className={`absolute top-0 left-[69%] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 ${!prefersReducedMotion ? "animate-pulse" : ""}`}
            style={{
              color: HERO_COLORS.accent,
            }}
          >
            ?
          </span>
        </h1>

        {/* Description + Animated Sub-text */}
        <div
          className="w-full px-4 md:w-[70%] lg:w-[55%] text-center -tracking-[2%]"
          style={{
            color: HERO_COLORS.text,
          }}
        >
          <div
            aria-live="polite"
            aria-atomic="true"
            className="min-h-[30px] md:min-h-[44px] lg:min-h-[56px]"
          >
            <TypeAnimation
              sequence={HERO_ANIMATIONS.descriptionSequence}
              wrapper="span"
              speed={HERO_ANIMATIONS.subSpeed}
              repeat={prefersReducedMotion ? 1 : Infinity}
              preRenderFirstString
              className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-center block"
              style={{
                color: HERO_COLORS.text,
              }}
            />
          </div>
          <p className="font-dmSans font-[400] md:text-[18px] text-[14px] mt-4">
            Step into Tycoon — the Web3 twist on the classic game of strategy,
            ownership, and fortune. Play solo against AI, compete in multiplayer
            rooms, collect tokens, complete quests, and become the ultimate
            blockchain tycoon.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="z-1 w-full flex flex-col justify-center items-center mt-6 gap-4">
          {/* Continue Game */}
          <button
            data-testid="hero-primary-cta"
            aria-label="Continue game"
            onClick={() => handleTrackedNavigation("continue_game_click", "/game-settings")}
            className="relative group w-[300px] h-[56px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-105"
          >
            <svg
              aria-hidden="true"
              width="300"
              height="56"
              viewBox="0 0 300 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full transform scale-x-[-1] ${!prefersReducedMotion ? "group-hover:animate-pulse" : ""}`}
            >
              <path
                d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                fill="#00F0FF"
                stroke="#0E282A"
                strokeWidth={2}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[20px] font-orbitron font-[700] z-2">
              <Gamepad2 className="mr-2 w-7 h-7" />
              Continue Game
            </span>
          </button>

          {/* Multiplayer */}
          <button
            aria-label="Multiplayer"
            onClick={() => handleTrackedNavigation("multiplayer_click", "/game-settings")}
            className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
          >
            <svg
              aria-hidden="true"
              width="227"
              height="40"
              viewBox="0 0 227 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1] ${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
            >
              <path
                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#003B3E"
                stroke="#003B3E"
                strokeWidth={1}
                className={`${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
              <Gamepad2 className="mr-1.5 w-[16px] h-[16px]" />
              Multiplayer
            </span>
          </button>

          {/* Join Room */}
          <button
            aria-label="Join room"
            onClick={() => handleTrackedNavigation("join_room_click", "/join-room")}
            className="relative group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
          >
            <svg
              aria-hidden="true"
              width="140"
              height="40"
              viewBox="0 0 140 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full ${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
            >
              <path
                d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                fill="#0E1415"
                stroke="#003B3E"
                strokeWidth={1}
                className={`${!prefersReducedMotion ? "group-hover:stroke-[#00F0FF] transition-all duration-300" : ""}`}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-2">
              <Dices className="mr-1.5 w-[16px] h-[16px]" />
              Join Room
            </span>
          </button>

          {/* Challenge AI */}
          <button
            aria-label="Challenge AI"
            onClick={() => handleTrackedNavigation("challenge_ai_click", "/play-ai")}
            className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform duration-300 group-hover:scale-105"
          >
            <svg
              aria-hidden="true"
              width="260"
              height="52"
              viewBox="0 0 260 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`absolute top-0 left-0 w-full h-full transform scale-x-[-1] ${!prefersReducedMotion ? "group-hover:animate-pulse" : ""}`}
            >
              <path
                d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                fill="#00F0FF"
                stroke="#0E282A"
                strokeWidth={1}
              />
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[#010F10] uppercase text-[16px] -tracking-[2%] font-orbitron font-[700] z-2">
              Challenge AI!
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
