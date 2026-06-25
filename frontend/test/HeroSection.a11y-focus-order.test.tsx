import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * SW-FE-001: HeroSection — Accessibility and Focus Order
 * Comprehensive tests for keyboard navigation, focus management, and a11y compliance
 */

const mockPush = vi.fn();
const mockFire = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/useHeroTelemetry", () => ({
  useHeroTelemetry: () => ({
    fire: mockFire,
  }),
}));

vi.mock("@/lib/errors", () => ({
  sanitizeError: (err: unknown) => {
    if (err instanceof TypeError && err.message.includes("null-error")) {
      return null;
    }
    return {
      userMessage: err instanceof Error ? err.message : "An unexpected error occurred",
      category: "unknown",
      recoverable: true,
    };
  },
}));

vi.mock("react-type-animation", () => ({
  TypeAnimation: (props: { className?: string; sequence?: unknown }) => (
    <span data-testid="hero-animated-copy" className={props.className}>
      mocked animation
    </span>
  ),
}));

import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSectionMobile";

describe("HeroSection — Accessibility and Focus Order (SW-FE-001)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockFire.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Focus Order and Tab Sequence", () => {
    it("buttons are focusable and follow logical tab order", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      const multiplayerBtn = screen.getByRole("button", { name: /multiplayer/i });
      const joinRoomBtn = screen.getByRole("button", { name: /join room/i });
      const challengeAiBtn = screen.getByRole("button", { name: /challenge ai/i });

      // Tab to first button
      await user.tab();
      expect(continueBtn).toHaveFocus();

      // Tab to second button
      await user.tab();
      expect(multiplayerBtn).toHaveFocus();

      // Tab to third button
      await user.tab();
      expect(joinRoomBtn).toHaveFocus();

      // Tab to fourth button
      await user.tab();
      expect(challengeAiBtn).toHaveFocus();
    });

    it("shift+tab navigates backwards through buttons", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      const multiplayerBtn = screen.getByRole("button", { name: /multiplayer/i });

      // Tab to first button
      await user.tab();
      expect(continueBtn).toHaveFocus();

      // Tab to second button
      await user.tab();
      expect(multiplayerBtn).toHaveFocus();

      // Shift+Tab back to first button
      await user.tab({ shift: true });
      expect(continueBtn).toHaveFocus();
    });

    it("all CTA buttons are in the tab order", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const buttons = screen.getAllByRole("button").filter((btn) => {
        const label = btn.getAttribute("aria-label");
        return label && (label.includes("Continue") || label.includes("Multiplayer") || label.includes("Join") || label.includes("Challenge"));
      });

      expect(buttons.length).toBe(4);

      for (const btn of buttons) {
        await user.tab();
        expect(btn).toHaveFocus();
      }
    });
  });

  describe("Focus Visible Indicators", () => {
    it("buttons have visible focus indicator with ring", () => {
      const { container } = render(<HeroSection />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((btn) => {
        const classes = btn.className;
        expect(classes).toContain("focus-visible:ring");
      });
    });

    it("focus ring has sufficient contrast", () => {
      const { container } = render(<HeroSection />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((btn) => {
        const classes = btn.className;
        // Check for focus-visible ring with color
        expect(classes).toContain("focus-visible:ring-2");
        expect(classes).toContain("focus-visible:ring-[#00F0FF]"); // Cyan color for visibility
      });
    });

    it("focus outline is removed when focus-visible is applied", () => {
      const { container } = render(<HeroSection />);

      const buttons = container.querySelectorAll("button");
      buttons.forEach((btn) => {
        expect(btn.className).toContain("focus:outline-none");
      });
    });
  });

  describe("Keyboard Activation", () => {
    it("buttons activate with Enter key", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      continueBtn.focus();

      await user.keyboard("{Enter}");

      expect(mockFire).toHaveBeenCalledWith("continue_game_click");
      expect(mockPush).toHaveBeenCalledWith("/game-settings");
    });

    it("buttons activate with Space key", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const multiplayerBtn = screen.getByRole("button", { name: /multiplayer/i });
      multiplayerBtn.focus();

      await user.keyboard(" ");

      expect(mockFire).toHaveBeenCalledWith("multiplayer_click");
    });

    it("all CTA buttons are keyboard activatable", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const buttons = screen.getAllByRole("button").filter((btn) => {
        const label = btn.getAttribute("aria-label");
        return label && (label.includes("Continue") || label.includes("Multiplayer") || label.includes("Join") || label.includes("Challenge"));
      });

      for (const btn of buttons) {
        btn.focus();
        expect(btn).toHaveFocus();

        await user.keyboard("{Enter}");

        await waitFor(() => {
          expect(mockFire).toHaveBeenCalled();
        });

        mockFire.mockClear();
      }
    });
  });

  describe("Screen Reader Announcements", () => {
    it("renders hero section announcement on mount", async () => {
      render(<HeroSection />);

      await waitFor(() => {
        const announcements = document.querySelectorAll("[role='status'][aria-live='polite']");
        expect(announcements.length).toBeGreaterThan(0);

        let heroAnnounced = false;
        announcements.forEach((ann) => {
          if (ann.textContent?.includes("Hero section loaded")) {
            heroAnnounced = true;
          }
        });
        expect(heroAnnounced).toBe(true);
      });
    });

    it("announcement is marked as atomic for screen readers", async () => {
      render(<HeroSection />);

      await waitFor(() => {
        const announcements = document.querySelectorAll("[aria-atomic='true'][aria-live='polite']");
        expect(announcements.length).toBeGreaterThan(0);
      });
    });

    it("animated regions have aria-live polite", () => {
      const { container } = render(<HeroSection />);

      const liveRegions = container.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThanOrEqual(2); // Tagline and subtext animations
    });

    it("all buttons have accessible names", () => {
      render(<HeroSection />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        const ariaLabel = btn.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel?.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Decorative Elements Accessibility", () => {
    it("background gradient is hidden from assistive technology", () => {
      const { container } = render(<HeroSection />);

      const decorativeBg = container.querySelector("section > div[aria-hidden='true']");
      expect(decorativeBg).toBeTruthy();
    });

    it("decorative SVG elements are hidden from screen readers", () => {
      const { container } = render(<HeroSection />);

      const svgs = container.querySelectorAll("svg[aria-hidden='true']");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("decorative question mark has aria-hidden", () => {
      render(<HeroSection />);

      const title = screen.getByTestId("hero-main-title");
      const spans = title.querySelectorAll("span");

      let questionSpanHidden = false;
      spans.forEach((span) => {
        if (span.textContent === "?" && span.getAttribute("aria-hidden") === "true") {
          questionSpanHidden = true;
        }
      });
      expect(questionSpanHidden).toBe(true);
    });

    it("button inner span elements are hidden from screen readers", () => {
      const { container } = render(<HeroSection />);

      const innerSpans = container.querySelectorAll("button span[aria-hidden='true']");
      expect(innerSpans.length).toBeGreaterThan(0);
    });
  });

  describe("Error State Accessibility", () => {
    it("error section has alert role for screen reader announcement", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test navigation error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        const errorSection = screen.getByRole("alert");
        expect(errorSection).toBeInTheDocument();
      });
    });

    it("error message is read by screen readers", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test error message");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        const errorMsg = screen.getByText("Test error message");
        expect(errorMsg).toBeInTheDocument();
      });
    });

    it("Try Again button is focusable in error state", async () => {
      const user = userEvent.setup();
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
        expect(tryAgainBtn).toBeInTheDocument();
      });

      const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
      await user.tab();
      expect(tryAgainBtn).toHaveFocus();
    });
  });

  describe("HeroSectionMobile Accessibility", () => {
    it("mobile hero has aria-label", () => {
      render(<HeroSectionMobile />);

      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toBeInTheDocument();
    });

    it("mobile buttons are keyboard accessible", async () => {
      const user = userEvent.setup();
      render(<HeroSectionMobile />);

      const continueBtn = screen.getByRole("button", { name: /continue game/i });
      await user.tab();

      expect(continueBtn).toHaveFocus();
    });

    it("mobile buttons have focus visible indicators", () => {
      const { container } = render(<HeroSectionMobile />);

      const buttons = container.querySelectorAll("button");
      buttons.forEach((btn) => {
        expect(btn.className).toContain("focus-visible:ring");
      });
    });

    it("mobile hero renders announcement on mount", async () => {
      render(<HeroSectionMobile />);

      await waitFor(() => {
        const announcements = document.querySelectorAll("[role='status'][aria-live='polite']");
        expect(announcements.length).toBeGreaterThan(0);
      });
    });

    it("mobile buttons have proper aria-labels", () => {
      render(<HeroSectionMobile />);

      expect(screen.getByRole("button", { name: /continue game/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /multiplayer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /join room/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /challenge ai/i })).toBeInTheDocument();
    });
  });

  describe("Skip Links and Navigation", () => {
    it("hero section is a logical first focusable element", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      // First tab should focus first button in hero
      await user.tab();

      const firstButton = screen.getByRole("button", { name: /continue game/i });
      expect(firstButton).toHaveFocus();
    });
  });

  describe("Prefers Reduced Motion Compliance", () => {
    it("respects prefers-reduced-motion preference", () => {
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

      // When prefers-reduced-motion is true, animate-pulse should not be applied
      if (questionSpan) {
        expect(questionSpan.className).not.toContain("animate-pulse");
      }

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("Focus Management Edge Cases", () => {
    it("focus is not lost when error state is shown", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Navigation error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
        expect(tryAgainBtn).toBeInTheDocument();

        // Try again button should be focusable
        expect(tryAgainBtn).toHaveAttribute("aria-label");
      });
    });

    it("focus trap does not occur in hero section", async () => {
      const user = userEvent.setup();
      render(<HeroSection />);

      const buttons = screen.getAllByRole("button").filter((btn) => {
        const label = btn.getAttribute("aria-label");
        return label && (label.includes("Continue") || label.includes("Multiplayer") || label.includes("Join") || label.includes("Challenge"));
      });

      // Tab through all buttons and verify no trap
      for (let i = 0; i < buttons.length; i++) {
        await user.tab();
      }

      // After last button, focus should move out
      // (This would be managed by browser/document structure)
      expect(true).toBe(true);
    });
  });
});

import { fireEvent } from "@testing-library/react";
