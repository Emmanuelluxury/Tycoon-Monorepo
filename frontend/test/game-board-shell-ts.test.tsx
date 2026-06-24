/**
 * SW-FE-042: Game board shell — TypeScript strictness and null guards tests.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { BoardSquare } from '@/components/game/BoardSquare';
import { useGameBoardLogic } from '@/hooks/useGameBoardLogic';

describe('SW-FE-042: Game board shell — TypeScript strictness and null guards', () => {
  describe('BoardSquare', () => {
    it('omits position from aria-label when position is undefined', () => {
      render(<BoardSquare name="Test" color="bg-red-500" />);
      const cell = screen.getByRole('gridcell');
      expect(cell).toHaveAttribute('aria-label', 'Test square, type property');
      expect(cell.getAttribute('aria-label')).not.toContain('undefined');
    });

    it('returns null when name is missing', () => {
      const { container } = render(
        <BoardSquare name="" color="bg-red-500" position={1} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('useGameBoardLogic', () => {
    it('returns a defined currentPlayer', () => {
      const { result } = renderHook(() => useGameBoardLogic());
      expect(result.current.currentPlayer).toBeDefined();
      expect(result.current.currentPlayer.id).toBeTruthy();
      expect(result.current.players.length).toBeGreaterThan(0);
    });
  });
});
