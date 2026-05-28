import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JoinRoomForm, { isValidRoomCode } from "@/components/settings/JoinRoomForm";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// --- Unit: isValidRoomCode ---
describe("isValidRoomCode", () => {
  it("accepts exactly 6 alphanumeric characters", () => {
    expect(isValidRoomCode("TYCOON")).toBe(true);
    expect(isValidRoomCode("ABC123")).toBe(true);
    expect(isValidRoomCode("000000")).toBe(true);
  });

  it("rejects codes shorter than 6 characters", () => {
    expect(isValidRoomCode("TYC")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });

  it("rejects codes longer than 6 characters", () => {
    expect(isValidRoomCode("TYCOON1")).toBe(false);
  });

  it("rejects codes with special characters", () => {
    expect(isValidRoomCode("TYC!ON")).toBe(false);
    expect(isValidRoomCode("TYC ON")).toBe(false);
  });

  it("trims whitespace before validating", () => {
    expect(isValidRoomCode("  TYCOON  ")).toBe(true);
  });
});

// --- Integration: JoinRoomForm component ---
describe("JoinRoomForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the room code input and join button", () => {
    render(<JoinRoomForm />);
    expect(screen.getByLabelText(/room code/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /join/i })).toBeDefined();
  });

  it("join button is disabled when input is empty", () => {
    render(<JoinRoomForm />);
    const btn = screen.getByRole("button", { name: /join/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("join button is disabled for an invalid code", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i);
    await user.type(input, "ABC");
    const btn = screen.getByRole("button", { name: /join/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("join button is enabled for a valid 6-char code", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i);
    await user.type(input, "TYCOON");
    const btn = screen.getByRole("button", { name: /join/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("normalises input to uppercase", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i) as HTMLInputElement;
    await user.type(input, "tycoon");
    expect(input.value).toBe("TYCOON");
  });

  it("caps input at 6 characters", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i) as HTMLInputElement;
    await user.type(input, "TYCOON99");
    expect(input.value.length).toBeLessThanOrEqual(6);
  });

  it("shows an error message on submit with invalid code", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i);
    await user.type(input, "ABC");
    // Manually submit the form (button is disabled, so submit via form)
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("sets aria-invalid on the input when there is an error", async () => {
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i) as HTMLInputElement;
    fireEvent.submit(input.closest("form")!);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("clears the error when the user starts typing again", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i);
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toBeDefined();
    await user.type(input, "A");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("navigates to /game-waiting with the normalised code on valid submit", async () => {
    const user = userEvent.setup();
    render(<JoinRoomForm />);
    const input = screen.getByLabelText(/room code/i);
    await user.type(input, "tycoon");
    await user.click(screen.getByRole("button", { name: /join/i }));
    expect(mockPush).toHaveBeenCalledWith("/game-waiting?gameCode=TYCOON");
  });
});
