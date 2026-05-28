import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PlayerList } from "@/components/game/PlayerList";
import type { PlayerSlot } from "@/components/game/PlayerList";

const PLAYERS: PlayerSlot[] = [
  { id: "1", name: "Alice", symbol: "ship", state: "host" },
  { id: "2", name: "Bob", symbol: "car", state: "ready" },
];

describe("PlayerList", () => {
  it("renders the correct number of slots (maxPlayers default = 4)", () => {
    render(<PlayerList players={PLAYERS} />);
    const list = screen.getByTestId("player-list");
    // 4 slots total
    expect(list.querySelectorAll("[data-slot-index]").length).toBe(4);
  });

  it("renders the correct number of slots when maxPlayers is overridden", () => {
    render(<PlayerList players={PLAYERS} maxPlayers={2} />);
    const list = screen.getByTestId("player-list");
    expect(list.querySelectorAll("[data-slot-index]").length).toBe(2);
  });

  it("shows player names for filled slots", () => {
    render(<PlayerList players={PLAYERS} />);
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("shows 'Open' for empty slots", () => {
    render(<PlayerList players={PLAYERS} maxPlayers={4} />);
    const openSlots = screen.getAllByText("Open");
    expect(openSlots.length).toBe(2);
  });

  it("marks empty slots with data-empty=true", () => {
    render(<PlayerList players={PLAYERS} maxPlayers={4} />);
    const list = screen.getByTestId("player-list");
    const emptySlots = list.querySelectorAll("[data-empty='true']");
    expect(emptySlots.length).toBe(2);
  });

  it("marks filled slots with data-empty=false", () => {
    render(<PlayerList players={PLAYERS} maxPlayers={4} />);
    const list = screen.getByTestId("player-list");
    const filledSlots = list.querySelectorAll("[data-empty='false']");
    expect(filledSlots.length).toBe(2);
  });

  it("renders the host badge for the host player", () => {
    render(<PlayerList players={PLAYERS} />);
    expect(screen.getByText("Host")).toBeDefined();
  });

  it("renders the ready badge for a ready player", () => {
    render(<PlayerList players={PLAYERS} />);
    expect(screen.getByText("Ready")).toBeDefined();
  });

  it("renders the correct emoji for known symbols", () => {
    render(<PlayerList players={[{ id: "1", name: "Alice", symbol: "ship" }]} maxPlayers={1} />);
    expect(screen.getByText("🚢")).toBeDefined();
  });

  it("renders ❓ for an unknown symbol", () => {
    render(<PlayerList players={[{ id: "1", name: "Alice", symbol: "unknown" }]} maxPlayers={1} />);
    expect(screen.getByText("unknown")).toBeDefined();
  });

  it("renders ❓ for a slot with no symbol", () => {
    render(<PlayerList players={[{ id: "1", name: "Alice" }]} maxPlayers={1} />);
    expect(screen.getByText("❓")).toBeDefined();
  });

  it("applies a custom className to the grid container", () => {
    render(<PlayerList players={[]} className="custom-class" />);
    const list = screen.getByTestId("player-list");
    expect(list.className).toContain("custom-class");
  });

  it("renders nothing broken when players array is empty", () => {
    render(<PlayerList players={[]} maxPlayers={4} />);
    expect(screen.getAllByText("Open").length).toBe(4);
  });
});
