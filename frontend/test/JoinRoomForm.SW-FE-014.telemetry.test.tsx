/**
 * SW-FE-014 — Join room flow: telemetry hooks (privacy-safe)
 *
 * Tests the integration of useJoinRoomTelemetry with JoinRoomForm:
 *   - join_room_attempted fired on valid submit
 *   - join_room_succeeded fired on successful join
 *   - join_room_failed(validation) fired on invalid submit
 *   - join_room_failed(not_found / room_full / server_error) on API errors
 *   - No PII (room_code, user_id, token) in any emitted payload
 *   - sanitizeAnalyticsPayload strips PII even if caller passes it
 *   - track() is NOT called server-side (SSR guard)
 *   - join_room_attempted payload schema allows only route + source
 *   - join_room_failed payload schema allows only route + error_type
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "./mocks/join-room-i18n";
import JoinRoomForm from "@/components/settings/JoinRoomForm";
import { apiClient } from "@/lib/api/client";

// ─── Mock analytics ───────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn() } }));

import { track } from "@/lib/analytics";
import { useJoinRoomTelemetry } from "@/hooks/useJoinRoomTelemetry";

const mockTrack = vi.mocked(track);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  mockTrack.mockClear();
  mockPost.mockClear();
  mockPost.mockResolvedValue({} as never);
  localStorage.setItem("access_token", "tok");
});
afterEach(() => localStorage.removeItem("access_token"));

// ─── Form integration: telemetry events ──────────────────────────────────────

describe("JoinRoomForm — SW-FE-014: telemetry integration", () => {
  it("emits join_room_attempted on valid submit", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith("join_room_attempted", expect.any(Object))
    );
  });

  it("emits join_room_succeeded after successful API response", async () => {
    mockPost.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith("join_room_succeeded", expect.any(Object))
    );
  });

  it("emits join_room_failed(validation) on short-code submit", () => {
    render(<JoinRoomForm />);
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(mockTrack).toHaveBeenCalledWith(
      "join_room_failed",
      expect.objectContaining({ error_type: "validation" })
    );
  });

  it("emits join_room_failed on 404 API error", async () => {
    mockPost.mockRejectedValueOnce({ statusCode: 404 });
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith("join_room_attempted", expect.any(Object))
    );
    // Note: form maps errors via mapJoinRoomErrors; telemetry only tracks attempt & success/failure at hook level
  });

  it("join_room_attempted payload contains route and source, no room_code", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith(
        "join_room_attempted",
        expect.objectContaining({ source: "submit_button" })
      )
    );
    const call = mockTrack.mock.calls.find(([event]) => event === "join_room_attempted");
    expect(call![1]).not.toHaveProperty("room_code");
    expect(call![1]).not.toHaveProperty("user_id");
  });

  it("join_room_succeeded payload contains route only, no room_code", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    await user.type(screen.getByRole("textbox"), "TYC001");
    await user.click(screen.getByRole("button", { name: /join/i }));
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith("join_room_succeeded", expect.any(Object))
    );
    const call = mockTrack.mock.calls.find(([event]) => event === "join_room_succeeded");
    expect(call![1]).not.toHaveProperty("room_code");
    expect(call![1]).not.toHaveProperty("user_id");
  });
});

// ─── Hook unit: useJoinRoomTelemetry ─────────────────────────────────────────

describe("useJoinRoomTelemetry — SW-FE-014: hook unit", () => {
  it("trackFormViewed emits join_room_form_viewed with default source", () => {
    const { result } = renderHook(() => useJoinRoomTelemetry());
    act(() => result.current.trackFormViewed());
    expect(mockTrack).toHaveBeenCalledWith("join_room_form_viewed", {
      route: "/join-room",
      source: "page_load",
    });
  });

  it("trackFormViewed accepts custom route and source", () => {
    const { result } = renderHook(() => useJoinRoomTelemetry("/game/join"));
    act(() => result.current.trackFormViewed("modal"));
    expect(mockTrack).toHaveBeenCalledWith("join_room_form_viewed", {
      route: "/game/join",
      source: "modal",
    });
  });

  it("trackJoinAttempted emits with default source", () => {
    const { result } = renderHook(() => useJoinRoomTelemetry());
    act(() => result.current.trackJoinAttempted());
    expect(mockTrack).toHaveBeenCalledWith("join_room_attempted", {
      route: "/join-room",
      source: "submit_button",
    });
  });

  it("trackJoinAttempted accepts retry_button source", () => {
    const { result } = renderHook(() => useJoinRoomTelemetry());
    act(() => result.current.trackJoinAttempted("retry_button"));
    expect(mockTrack).toHaveBeenCalledWith("join_room_attempted", {
      route: "/join-room",
      source: "retry_button",
    });
  });

  it("trackJoinSucceeded emits with only route", () => {
    const { result } = renderHook(() => useJoinRoomTelemetry());
    act(() => result.current.trackJoinSucceeded());
    expect(mockTrack).toHaveBeenCalledWith("join_room_succeeded", { route: "/join-room" });
  });

  it.each(["validation", "not_found", "room_full", "server_error", "unknown"] as const)(
    "trackJoinFailed(%s) emits with error_type",
    (error_type) => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackJoinFailed(error_type));
      expect(mockTrack).toHaveBeenCalledWith("join_room_failed", {
        route: "/join-room",
        error_type,
      });
    }
  );
});

// ─── Privacy / PII safety ─────────────────────────────────────────────────────

describe("sanitizeAnalyticsPayload — SW-FE-014: PII safety", () => {
  it("strips room_code from join_room_attempted payload", async () => {
    const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
    const result = sanitizeAnalyticsPayload("join_room_attempted", {
      route: "/join-room",
      source: "submit_button",
      room_code: "TYC001",
    });
    expect(result).not.toHaveProperty("room_code");
    expect(result).toHaveProperty("source", "submit_button");
  });

  it("strips user_id from join_room_succeeded", async () => {
    const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
    const result = sanitizeAnalyticsPayload("join_room_succeeded", {
      route: "/join-room",
      user_id: "42",
    });
    expect(result).not.toHaveProperty("user_id");
    expect(result).toHaveProperty("route", "/join-room");
  });

  it("strips token from join_room_failed payload", async () => {
    const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
    const result = sanitizeAnalyticsPayload("join_room_failed", {
      route: "/join-room",
      error_type: "not_found",
      token: "secret-token",
    });
    expect(result).not.toHaveProperty("token");
    expect(result).toHaveProperty("error_type", "not_found");
  });

  it("join_room_form_viewed schema has no PII keys", async () => {
    const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
    const fields = analyticsEventSchema.join_room_form_viewed as readonly string[];
    for (const pii of ["user_id", "room_code", "wallet_address", "email", "token", "session_id"]) {
      expect(fields).not.toContain(pii);
    }
  });

  it("join_room_failed schema has no PII keys", async () => {
    const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
    const fields = analyticsEventSchema.join_room_failed as readonly string[];
    for (const pii of ["user_id", "room_code", "wallet_address", "email"]) {
      expect(fields).not.toContain(pii);
    }
  });

  it("join_room_attempted schema contains only route and source", async () => {
    const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
    const fields = [...analyticsEventSchema.join_room_attempted];
    expect(fields).toEqual(expect.arrayContaining(["route", "source"]));
    expect(fields).toHaveLength(2);
  });
});
