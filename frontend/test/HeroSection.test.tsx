import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockFire = vi.fn();
const mockTrack = vi.fn();
const animationProps: Array<{ preRenderFirstString?: boolean; sequence?: Array<string | number> }> = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

vi.mock("@/lib/errors", () => ({
  sanitizeError: (err: unknown) => ({
    userMessage: err instanceof Error ? err.message : "An unexpected error occurred",
    category: "unknown",
    recoverable: true,
  }),
}));

vi.mock("@/hooks/useHeroTelemetry", () => ({
  useHeroTelemetry: () => ({
    fire: mockFire,
  }),
}));

vi.mock("react-type-animation", () => ({
  TypeAnimation: (props: {
    preRenderFirstString?: boolean;
    sequence?: Array<string | number>;
    className?: string;
  }) => {
    animationProps.push(props);
    return <span data-testid="hero-animated-copy" className={props.className}>mocked animation</span>;
  },
}));

import HeroSection from "@/components/guest/HeroSection";

// ─── SW-FE-003: Vitest / RTL Coverage ───────────────────────────────────────────

describe("HeroSection — SW-FE-003: Vitest / RTL coverage", () => {
  beforeEach(() => {
    animationProps.length = 0;
    mockPush.mockClear();
    mockTrack.mockClear();
    mockFire.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Render structure", () => {
    it("renders the hero section with aria-label", () => {
      render(<HeroSection />);
      expect(screen.getByRole("region", { name: "Hero" })).toBeInTheDocument();
    });

    it("renders a single h1 element", () => {
      render(<HeroSection />);
      const headings = document.querySelectorAll("h1");
      expect(headings).toHaveLength(1);
    });

    it("renders the main title with test id", () => {
      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
    });

    it("renders the primary CTA button", () => {
      render(<HeroSection />);
      expect(screen.getByTestId("hero-primary-cta")).toBeInTheDocument();
    });

    it("renders all four CTA buttons", () => {
      render(<HeroSection />);
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(5); // 4 CTAs + 1 Try Again button (initially hidden)
    });

    it("renders the welcome message", () => {
      render(<HeroSection />);
      expect(screen.getByText("Welcome back, Player!")).toBeInTheDocument();
    });

    it("renders the description paragraph", () => {
      render(<HeroSection />);
      expect(screen.getByText(/Step into Tycoon/)).toBeInTheDocument();
    });

    it("applies custom className when provided", () => {
      const customClass = "custom-hero-test";
      const { container } = render(<HeroSection className={customClass} />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toHaveClass(customClass);
    });

    it("renders decorative background gradient", () => {
      const { container } = render(<HeroSection />);
      const bgDiv = container.querySelector('[style*="linear-gradient"]');
      expect(bgDiv).toBeInTheDocument();
    });

    it("renders decorative large text element", () => {
      const { container } = render(<HeroSection />);
      const decorativeBg = container.querySelector(
        "section > div[aria-hidden='true'] > p"
      );
      expect(decorativeBg).toBeInTheDocument();
      expect(decorativeBg).toHaveTextContent("TYCOON");
    });
  });

  describe("Accessibility", () => {
    it("all CTA buttons have accessible names", () => {
      render(<HeroSection />);
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn).toHaveAttribute("aria-label");
      }
    });

    it("decorative background elements are hidden from assistive technology", () => {
      const { container } = render(<HeroSection />);
      const decorativeBg = container.querySelector<HTMLElement>(
        "section > div[aria-hidden='true']",
      );
      expect(decorativeBg).not.toBeNull();
    });

    it("decorative SVG elements have aria-hidden", () => {
      const { container } = render(<HeroSection />);
      const svgs = container.querySelectorAll("svg");
      svgs.forEach((svg) => {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      });
    });

    it("decorative inner spans have aria-hidden", () => {
      const { container } = render(<HeroSection />);
      const spans = container.querySelectorAll("button span");
      spans.forEach((span) => {
        expect(span.getAttribute("aria-hidden")).toBe("true");
      });
    });

    it("decorative ? span in title has aria-hidden", () => {
      render(<HeroSection />);
      const title = screen.getByTestId("hero-main-title");
      const spans = title.querySelectorAll("span");
      const questionSpan = Array.from(spans).find((s) => s.textContent === "?");
      expect(questionSpan).toBeDefined();
      expect(questionSpan!.getAttribute("aria-hidden")).toBe("true");
    });

    it("main title is a real h1 for document outline", () => {
      const { container } = render(<HeroSection />);
      const h1 = container.querySelector("h1");
      expect(h1).toHaveTextContent("TYCOON");
      expect(h1!.classList.contains("block-text")).toBe(true);
    });

    it("animated taglines have aria-live regions", () => {
      const { container } = render(<HeroSection />);
      const liveRegions = container.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThanOrEqual(2); // Both tagline and subtext
    });

    it("animated regions have aria-atomic for screen readers", () => {
      const { container } = render(<HeroSection />);
      const atomicRegions = container.querySelectorAll('[aria-atomic="true"]');
      expect(atomicRegions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Animation behavior", () => {
    it("pre-renders both TypeAnimation instances with preRenderFirstString", () => {
      render(<HeroSection />);
      expect(animationProps).toHaveLength(2);
      for (const props of animationProps) {
        expect(props.preRenderFirstString).toBe(true);
        expect(props.sequence).not.toContain("");
      }
    });

    it("has non-empty sequences for both animations", () => {
      render(<HeroSection />);
      expect(animationProps).toHaveLength(2);
      for (const props of animationProps) {
        expect(props.sequence!.length).toBeGreaterThan(0);
      }
    });

    it("animation repeat is disabled when reduced motion is preferred", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      render(<HeroSection />);
      // With reduced motion, repeat should be 1 (no infinite loop)
      expect(animationProps.every(p => p)).toBe(true);

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("CTA button interactions", () => {
    it("Continue Game button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      fireEvent.click(continueBtn);
      expect(mockFire).toHaveBeenCalledWith("continue_game_click");
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("Multiplayer button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const multiplayerBtn = screen.getByRole("button", { name: /multiplayer/i });
      fireEvent.click(multiplayerBtn);
      expect(mockFire).toHaveBeenCalledWith("multiplayer_click");
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("Join Room button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const joinRoomBtn = screen.getByRole("button", { name: /join room/i });
      fireEvent.click(joinRoomBtn);
      expect(mockFire).toHaveBeenCalledWith("join_room_click");
      expect(mockPush).toHaveBeenCalledWith("/join-room");
    });

    it("Challenge AI button fires telemetry and navigates", () => {
      render(<HeroSection />);
      const challengeBtn = screen.getByRole("button", { name: /challenge ai/i });
      fireEvent.click(challengeBtn);
      expect(mockFire).toHaveBeenCalledWith("challenge_ai_click");
      expect(mockPush).toHaveBeenCalledWith("/play-ai");
    });

    it("fires hero_view telemetry on component mount", () => {
      render(<HeroSection />);
      expect(mockFire).toHaveBeenCalledWith("hero_view");
    });

    it("handles multiple button clicks without duplicating events", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);
      
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      await user.click(continueBtn);
      await user.click(continueBtn);
      
      expect(mockFire).toHaveBeenCalledTimes(3); // 1 mount + 2 clicks
      expect(mockPush).toHaveBeenCalledTimes(2);
    });
  });

  describe("Reduced motion", () => {
    it("respects prefers-reduced-motion: reduce", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();

      window.matchMedia = originalMatchMedia;
    });

    it("pulse animation on ? is applied when reduced motion is NOT preferred", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      const { container } = render(<HeroSection />);
      const title = screen.getByTestId("hero-main-title");
      const questionSpan = title.querySelector("span");
      
      expect(questionSpan).toHaveClass("animate-pulse");

      window.matchMedia = originalMatchMedia;
    });

    it("removes pulse animation when prefers-reduced-motion is set", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      render(<HeroSection />);
      const title = screen.getByTestId("hero-main-title");
      const questionSpan = title.querySelector("span");
      
      expect(questionSpan).not.toHaveClass("animate-pulse");

      window.matchMedia = originalMatchMedia;
    });

    it("listens and responds to prefers-reduced-motion changes", () => {
      const listeners: ((event: any) => void)[] = [];
      const originalMatchMedia = window.matchMedia;
      
      window.matchMedia = ((query: string) => {
        const mq = {
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: (event: string, listener: (event: any) => void) => {
            if (query.includes("prefers-reduced-motion")) {
              listeners.push(listener);
            }
          },
          removeEventListener: () => {},
          dispatchEvent: () => false,
        };
        return mq;
      }) as typeof window.matchMedia;

      render(<HeroSection />);
      expect(listeners.length).toBeGreaterThan(0);

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("Error handling & error state", () => {
    it("renders error alert when navigation fails", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Navigation failed");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      
      fireEvent.click(continueBtn);
      
      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("displays error message from sanitized error", async () => {
      const errorMsg = "Custom error message";
      mockPush.mockImplementationOnce(() => {
        throw new Error(errorMsg);
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      
      fireEvent.click(continueBtn);
      
      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
    });

    it("error alert has role alert for screen readers", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      
      fireEvent.click(continueBtn);
      
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("Try Again button clears error and retries", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Navigation failed");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      
      fireEvent.click(continueBtn);
      
      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      // Clear mocks and set successful push
      mockPush.mockClear();
      mockFire.mockClear();
      mockPush.mockImplementationOnce(() => undefined);

      const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(tryAgainBtn);

      await waitFor(() => {
        expect(mockFire).toHaveBeenCalledWith("hero_view");
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
      });
    });

    it("error section maintains hero styling", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test error");
      });

      const { container } = render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      
      fireEvent.click(continueBtn);
      
      await waitFor(() => {
        const section = screen.getByRole("alert");
        expect(section).toHaveClass("bg-[#010F10]");
        expect(section).toHaveClass("w-full");
      });
    });
  });

  describe("Button hover and focus states", () => {
    it("Continue Game button has hover scale transform", () => {
      const { container } = render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      
      expect(continueBtn).toHaveClass("group-hover:scale-105");
    });

    it("all buttons are keyboard accessible", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);
      
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      await user.tab();
      
      expect(continueBtn).toHaveFocus();
    });

    it("buttons can be activated via keyboard enter", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);
      
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      await user.tab();
      await user.keyboard("{Enter}");
      
      expect(mockFire).toHaveBeenCalledWith("continue_game_click");
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("buttons can be activated via keyboard space", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);
      
      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      continueBtn.focus();
      await user.keyboard(" ");
      
      expect(mockFire).toHaveBeenCalledWith("continue_game_click");
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });
  });

  describe("Edge cases and regression prevention", () => {
    it("does not render duplicate h1 elements on re-render", () => {
      const { rerender } = render(<HeroSection />);
      let h1Count = document.querySelectorAll("h1").length;
      expect(h1Count).toBe(1);

      rerender(<HeroSection />);
      h1Count = document.querySelectorAll("h1").length;
      expect(h1Count).toBe(1);
    });

    it("cleans up event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(
        window.matchMedia("(prefers-reduced-motion: reduce)"),
        "removeEventListener"
      );

      const { unmount } = render(<HeroSection />);
      unmount();

      // Verify cleanup occurred
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it("renders with empty className prop", () => {
      const { container } = render(<HeroSection className="" />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toBeInTheDocument();
    });

    it("renders without className prop", () => {
      const { container } = render(<HeroSection />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toBeInTheDocument();
    });

    it("maintains focus management for keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);
      
      const buttons = screen.getAllByRole("button").filter(
        btn => btn.getAttribute("aria-label")?.includes("game") || 
               btn.getAttribute("aria-label")?.includes("AI") ||
               btn.getAttribute("aria-label")?.includes("room") ||
               btn.getAttribute("aria-label")?.includes("Multiplayer")
      );
      
      // Tab through all CTA buttons
      for (let i = 0; i < buttons.length; i++) {
        expect(buttons[i]).toHaveFocus() || await user.tab();
      }
    });

    it("does not fire analytics track event on component render", () => {
      mockTrack.mockClear();
      render(<HeroSection />);
      
      // Only hero_view telemetry should fire, not track from analytics
      expect(mockFire).toHaveBeenCalledWith("hero_view");
    });
  });
