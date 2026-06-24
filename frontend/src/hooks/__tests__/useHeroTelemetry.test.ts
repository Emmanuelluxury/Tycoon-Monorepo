import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHeroTelemetry, trackHeroEvent } from "../useHeroTelemetry";

describe("useHeroTelemetry", () => {
  let dispatchedEvents: any[] = [];

  beforeEach(() => {
    (process.env as any).NEXT_PUBLIC_TELEMETRY_ENABLED = "true";
    dispatchedEvents = [];
    vi.spyOn(window, "dispatchEvent").mockImplementation((event: any) => {
      if (event?.type === "tycoon:telemetry") {
        dispatchedEvents.push(event);
      }
      return true;
    });
  });

  it("should not dispatch when telemetry disabled", () => {
    (process.env as any).NEXT_PUBLIC_TELEMETRY_ENABLED = "false";
    trackHeroEvent("hero_view");
    expect(dispatchedEvents).toHaveLength(0);
  });

  it("should dispatch event with correct payload", () => {
    trackHeroEvent("hero_view");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]?.detail?.name).toBe("hero_view");
    expect(typeof dispatchedEvents[0]?.detail?.elapsed).toBe("number");
  });

  it("should include error type for error events", () => {
    trackHeroEvent("hero_error_displayed", "rate_limit_exceeded");
    expect(dispatchedEvents[0]?.detail?.errorType).toBe("rate_limit_exceeded");
  });

  it("should return stable fire callback", () => {
    const { result, rerender } = renderHook(() => useHeroTelemetry());
    const fire1 = result.current.fire;
    rerender();
    const fire2 = result.current.fire;
    expect(fire1).toBe(fire2);
  });

  it("should dispatch via fire callback", () => {
    const { result } = renderHook(() => useHeroTelemetry());
    act(() => {
      result.current.fire("hero_cta_click");
    });
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]?.detail?.name).toBe("hero_cta_click");
  });

  it("should dispatch error via fireError callback", () => {
    const { result } = renderHook(() => useHeroTelemetry());
    act(() => {
      result.current.fireError("validation_failed");
    });
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]?.detail?.name).toBe("hero_error_displayed");
    expect(dispatchedEvents[0]?.detail?.errorType).toBe("validation_failed");
  });

  it("should not include PII in payload", () => {
    trackHeroEvent("hero_view");
    const detail = dispatchedEvents[0]?.detail;
    expect(detail).not.toHaveProperty("user_id");
    expect(detail).not.toHaveProperty("ip");
    expect(detail).not.toHaveProperty("timestamp");
  });
});
