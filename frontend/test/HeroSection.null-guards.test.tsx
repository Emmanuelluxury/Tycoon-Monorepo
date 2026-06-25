import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * SW-FE-001: HeroSection — TypeScript strictness and null guards
 * Comprehensive tests for null safety, undefined checks, and strict type handling
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
    // Return null for certain error types to test null handling
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
  TypeAnimation: (props: { className?: string }) => (
    <span data-testid="hero-animated-copy" className={props.className}>
      mocked animation
    </span>
  ),
}));

import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSectionMobile";

describe("HeroSection — Null Guards and Strictness (SW-FE-001)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockFire.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Null safety in error handling", () => {
    it("handles sanitizeError returning null gracefully", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new TypeError("null-error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      // Should not show error state since sanitizeError returned null
      await waitFor(() => {
        expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
      });
    });

    it("safely accesses sanitized error message property", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test navigation error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        const errorMsg = screen.getByText("Test navigation error");
        expect(errorMsg).toBeInTheDocument();
      });
    });

    it("uses fallback message when userMessage is not available", async () => {
      vi.mocked(require("@/lib/errors").sanitizeError).mockReturnValueOnce({
        userMessage: undefined as any,
        category: "unknown",
        recoverable: true,
      });

      mockPush.mockImplementationOnce(() => {
        throw new Error("Error without message");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
      });
    });

    it("properly types the error parameter in catch block", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Typed error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(mockFire).toHaveBeenCalledWith("continue_game_click");
      });
    });
  });

  describe("Null coalescing operator usage", () => {
    it("uses nullish coalescing for className", () => {
      const { container } = render(<HeroSection className={undefined} />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toBeInTheDocument();
    });

    it("renders with null className", () => {
      const { container } = render(<HeroSection className={null as any} />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toBeInTheDocument();
    });

    it("renders with empty string className", () => {
      const { container } = render(<HeroSection className="" />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toBeInTheDocument();
    });

    it("respects provided className", () => {
      const { container } = render(<HeroSection className="custom-class" />);
      const section = screen.getByRole("region", { name: "Hero" });
      expect(section).toHaveClass("custom-class");
    });
  });

  describe("usePrefersReducedMotion null guard", () => {
    it("handles window being undefined (SSR case)", () => {
      const originalWindow = global.window;
      // @ts-expect-error Testing undefined window
      delete global.window;

      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();

      global.window = originalWindow;
    });

    it("handles matchMedia returning null or undefined", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (() => null) as any;

      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();

      window.matchMedia = originalMatchMedia;
    });

    it("properly types matchMedia event listener", () => {
      const listeners: Array<(event: MediaQueryListEvent) => void> = [];
      const originalMatchMedia = window.matchMedia;

      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (
          _event: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          if (query.includes("prefers-reduced-motion")) {
            listeners.push(listener);
          }
        },
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      const { unmount } = render(<HeroSection />);

      expect(listeners.length).toBeGreaterThan(0);

      // Simulate event with proper typing
      const mockEvent = new Event("change") as unknown as MediaQueryListEvent;
      listeners[0]?.(mockEvent);

      unmount();
      window.matchMedia = originalMatchMedia;
    });

    it("cleans up listeners on unmount with proper typing", () => {
      const removeEventListenerSpy = vi.fn();
      const originalMatchMedia = window.matchMedia;

      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: removeEventListenerSpy,
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;

      const { unmount } = render(<HeroSection />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("HeroSectionMobile null guards", () => {
    it("safely handles mobile component with undefined className", () => {
      const { container } = render(<HeroSectionMobile className={undefined} />);
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("applies custom className to mobile hero", () => {
      const { container } = render(<HeroSectionMobile className="mobile-custom" />);
      const section = container.querySelector("section");
      expect(section).toHaveClass("mobile-custom");
    });

    it("mobile component uses nullish coalescing", () => {
      const { container } = render(<HeroSectionMobile className={null as any} />);
      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("mobile component has same reduced motion guards", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (() => null) as any;

      render(<HeroSectionMobile />);
      expect(screen.getByText(/Welcome back, Player!/)).toBeInTheDocument();

      window.matchMedia = originalMatchMedia;
    });
  });

  describe("Type strictness in callbacks", () => {
    it("handleTrackedNavigation returns void explicitly", async () => {
      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      // Should complete without error
      await waitFor(() => {
        expect(mockFire).toHaveBeenCalled();
      });
    });

    it("callback properly types event parameter as union", async () => {
      render(<HeroSection />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);

      // All buttons should have proper event typing
      for (const btn of buttons) {
        const label = btn.getAttribute("aria-label");
        if (label && label.includes("game")) {
          fireEvent.click(btn);
          break;
        }
      }

      await waitFor(() => {
        expect(mockFire).toHaveBeenCalled();
      });
    });
  });

  describe("Props interface strictness", () => {
    it("requires HeroSectionProps to have optional className", () => {
      const props: { className?: string | undefined } = {};
      render(<HeroSection {...props} />);
      expect(screen.getByRole("region", { name: "Hero" })).toBeInTheDocument();
    });

    it("allows className as undefined in props", () => {
      const props = { className: undefined as string | undefined };
      render(<HeroSection {...props} />);
      expect(screen.getByRole("region", { name: "Hero" })).toBeInTheDocument();
    });

    it("enforces className type in mobile props", () => {
      const props: { className?: string | undefined } = { className: "test" };
      render(<HeroSectionMobile {...props} />);
      const section = screen.getByText(/Welcome back/).closest("section");
      expect(section).toHaveClass("test");
    });
  });

  describe("Error state interface strictness", () => {
    it("error state has proper interface with hasError and message", async () => {
      mockPush.mockImplementationOnce(() => {
        throw new Error("Test error");
      });

      render(<HeroSection />);
      const continueBtn = screen.getByRole("button", { name: /continue game/i });

      fireEvent.click(continueBtn);

      await waitFor(() => {
        const errorMessage = screen.getByText("Test error");
        const errorTitle = screen.getByText("Something went wrong");
        expect(errorMessage).toBeInTheDocument();
        expect(errorTitle).toBeInTheDocument();
      });
    });
  });
});
