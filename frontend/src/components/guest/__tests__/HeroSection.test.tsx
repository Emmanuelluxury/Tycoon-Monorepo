import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("should handle error state with alert role", async () => {
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
});
