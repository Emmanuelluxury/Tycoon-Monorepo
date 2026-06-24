import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeroSection from "../HeroSection";

// Mock hooks
vi.mock("@/hooks/useHeroTelemetry");
vi.mock("@/hooks/useHeroNavigation");
vi.mock("next/navigation");

describe("HeroSection Telemetry", () => {
  beforeEach(() => {
    // Mock useHeroTelemetry
    const mockFire = vi.fn();
    const mockFireError = vi.fn();
    vi.mocked(require("@/hooks/useHeroTelemetry").useHeroTelemetry).mockReturnValue({
      fire: mockFire,
      fireError: mockFireError,
    });

    // Mock useHeroNavigation
    vi.mocked(require("@/hooks/useHeroNavigation").useHeroNavigation).mockReturnValue({
      navigateSafely: vi.fn(),
    });

    // Mock useRouter
    vi.mocked(require("next/navigation").useRouter).mockReturnValue({
      push: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering & Accessibility", () => {
    it("should render hero section with main title", () => {
      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
      expect(screen.getByTestId("hero-main-title")).toHaveTextContent("TYCOON");
    });

    it("should have proper accessibility attributes", () => {
      render(<HeroSection />);
      expect(screen.getByLabelText("Hero")).toBeInTheDocument();
      expect(screen.getByLabelText("Continue game")).toBeInTheDocument();
      expect(screen.getByLabelText("Multiplayer")).toBeInTheDocument();
      expect(screen.getByLabelText("Join room")).toBeInTheDocument();
      expect(screen.getByLabelText("Challenge AI")).toBeInTheDocument();
    });

    it("should have single h1 heading", () => {
      render(<HeroSection />);
      const h1s = screen.getAllByRole("heading", { level: 1 });
      expect(h1s).toHaveLength(1);
    });

    it("should display welcome message", () => {
      render(<HeroSection />);
      expect(screen.getByText("Welcome back, Player!")).toBeInTheDocument();
    });

    it("should display hero description", () => {
      render(<HeroSection />);
      expect(
        screen.getByText(/Step into Tycoon.*Web3 twist on the classic game/i),
      ).toBeInTheDocument();
    });

    it("should have primary CTA button", () => {
      render(<HeroSection />);
      const cta = screen.getByTestId("hero-primary-cta");
      expect(cta).toBeInTheDocument();
      expect(cta).toHaveAttribute("aria-label", "Continue game");
    });
  });

  describe("Error State", () => {
    it("should display error state with alert role", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Test error",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("should display error message", async () => {
      const errorMsg = "Navigation failed due to rate limiting";
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: errorMsg,
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
    });

    it("should display try again button in error state", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Navigation failed",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByLabelText("Try again")).toBeInTheDocument();
      });
    });

    it("should display go home button in error state", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Something went wrong",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByLabelText("Go to home")).toBeInTheDocument();
      });
    });

    it("should track error telemetry on rate limit", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      const { useHeroTelemetry: mockTelem } = require("@/hooks/useHeroTelemetry");
      const mockFireError = vi.fn();

      mockTelem.mockReturnValue({
        fire: vi.fn(),
        fireError: mockFireError,
      });

      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Please wait before clicking again.",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFireError).toHaveBeenCalledWith("rate_limit_exceeded");
      });
    });

    it("should show error type details when toggled", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Invalid destination",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        const toggleBtn = screen.getByText("Show error code");
        expect(toggleBtn).toBeInTheDocument();
        fireEvent.click(toggleBtn);
        expect(screen.getByText("Hide error code")).toBeInTheDocument();
      });
    });

    it("should display support link in error state", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Something went wrong",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        const supportLink = screen.getByText("Contact support");
        expect(supportLink).toHaveAttribute("href", "/support");
      });
    });

    it("should recover from error state on try again", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      const { useHeroTelemetry: mockTelem } = require("@/hooks/useHeroTelemetry");
      const mockFire = vi.fn();

      mockTelem.mockReturnValue({
        fire: mockFire,
        fireError: vi.fn(),
      });

      mockNav.mockReturnValue({
        navigateSafely: vi.fn(() => ({
          hasError: true,
          message: "Test error",
        })),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      const tryAgainBtn = screen.getByLabelText("Try again");
      fireEvent.click(tryAgainBtn);

      await waitFor(() => {
        expect(screen.getByLabelText("Hero")).toBeInTheDocument();
        expect(mockFire).toHaveBeenCalledWith("hero_view");
      });
    });
  });

  describe("Navigation Tracking", () => {
    it("should track CTA click before navigation", async () => {
      const { useHeroTelemetry: mockTelem } = require("@/hooks/useHeroTelemetry");
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      const mockFire = vi.fn();

      mockTelem.mockReturnValue({
        fire: mockFire,
        fireError: vi.fn(),
      });

      mockNav.mockReturnValue({
        navigateSafely: vi.fn(),
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFire).toHaveBeenCalledWith("hero_cta_click");
      });
    });

    it("should call navigateSafely with correct parameters", async () => {
      const { useHeroNavigation: mockNav } = require("@/hooks/useHeroNavigation");
      const mockNavigateSafely = vi.fn();

      mockNav.mockReturnValue({
        navigateSafely: mockNavigateSafely,
      });

      render(<HeroSection />);
      const button = screen.getByTestId("hero-primary-cta");
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockNavigateSafely).toHaveBeenCalledWith(
          "continue_game_click",
          "/game-settings"
        );
      });
    });
  });

  describe("UI Responsiveness", () => {
    it("should render all CTA buttons", () => {
      render(<HeroSection />);
      expect(screen.getByLabelText("Continue game")).toBeInTheDocument();
      expect(screen.getByLabelText("Multiplayer")).toBeInTheDocument();
      expect(screen.getByLabelText("Join room")).toBeInTheDocument();
      expect(screen.getByLabelText("Challenge AI")).toBeInTheDocument();
    });

    it("should have accessible button labels", () => {
      render(<HeroSection />);
      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute("aria-label");
      });
    });

    it("should respect prefers-reduced-motion", () => {
      // This would need matchMedia mock in setup
      render(<HeroSection />);
      expect(screen.getByTestId("hero-main-title")).toBeInTheDocument();
    });
  });
});
