import { describe, expect, it } from "vitest";
import { useGameBoardLogic } from "@/hooks/useGameBoardLogic";

describe("useGameBoardLogic", () => {
  it("returns a defined current player", () => {
    const state = useGameBoardLogic();
    expect(state.currentPlayer).toBeDefined();
    expect(state.currentPlayer.id).toBe("player-1");
  });

  it("returns players and board arrays", () => {
    const state = useGameBoardLogic();
    expect(state.players.length).toBeGreaterThan(0);
    expect(state.board.length).toBeGreaterThan(0);
  });

  it("exposes a rollDice function", () => {
    const state = useGameBoardLogic();
    expect(typeof state.rollDice).toBe("function");
  });
});
