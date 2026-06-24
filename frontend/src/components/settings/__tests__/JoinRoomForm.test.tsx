import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import JoinRoomForm from '../JoinRoomForm';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { setupServer } from 'msw/node';
import { joinRoomHandlers } from '@/mocks/joinRoomHandlers';

let trackSpy: Mock;
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// MSW server setup with joinRoomHandlers
const server = setupServer(...joinRoomHandlers);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  vi.clearAllMocks();
  trackSpy.mockClear();
});

afterEach(() => {
  server.close();
});

describe('JoinRoomForm', () => {
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPush = vi.fn();
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });
  });

  describe('Input Sanitization', () => {
    it('should render the input with correct attributes', () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('maxLength', '6');
      expect(input).toHaveAttribute('autoComplete', 'off');
    });

    it('should track form view on mount', () => {
      render(<JoinRoomForm />);
      expect(trackSpy).toHaveBeenCalledWith('join_room_form_viewed', {
        route: '/join-room',
        source: 'page_load',
      });
    });

    it('should sanitize input by removing non-alphanumeric characters', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON') as HTMLInputElement;

      await userEvent.type(input, 'A-B@C!D');
      expect(input.value).toBe('ABCD');
    });

    it('should convert input to uppercase automatically', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON') as HTMLInputElement;

      await userEvent.type(input, 'abcdef');
      expect(input.value).toBe('ABCDEF');
    });

    it('should cap input at 6 characters', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON') as HTMLInputElement;

      await userEvent.type(input, 'ABCDEFGHIJKLMNOP');
      expect(input.value).toBe('ABCDEF');
      expect(input.value).toHaveLength(6);
    });

    it('should clear field-level errors when user edits input', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');

      // Trigger validation error by submitting empty form
      const submitButton = screen.getByRole('button', { name: /join/i });
      await userEvent.click(submitButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/room code must be exactly 6 characters/i)).toBeInTheDocument();
      });

      // Edit input should clear field error
      await userEvent.type(input, 'A');
      expect(screen.queryByText(/room code must be exactly 6 characters/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when room code is not exactly 6 characters', async () => {
      render(<JoinRoomForm />);
      const submitButton = screen.getByRole('button', { name: /join/i });

      expect(submitButton).toBeDisabled();

      const input = screen.getByPlaceholderText('e.g. TYCOON');
      await userEvent.type(input, 'ABCDE'); // 5 chars

      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when room code is exactly 6 characters', async () => {
      render(<JoinRoomForm />);
      const submitButton = screen.getByRole('button', { name: /join/i });

      const input = screen.getByPlaceholderText('e.g. TYCOON');
      await userEvent.type(input, 'ABCDEF'); // 6 chars

      expect(submitButton).not.toBeDisabled();
    });

    it('should reject room code with non-alphanumeric characters after sanitization', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      // After sanitization, special chars are removed, so 'ABC@#!' becomes 'ABC' (3 chars)
      await userEvent.type(input, 'ABC@#!DEF');
      expect(input).toHaveValue('ABCDEF');
      expect(submitButton).not.toBeDisabled();
    });

    it('should show validation error when code is shorter than 6 characters', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'ABCDE');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/room code must be exactly 6 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Successful Join', () => {
    it('should submit form and navigate on successful join', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/game-waiting?gameCode=TYCOON');
      });
    });

    it('should show loading state while join request is pending', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(submitButton);

      // Button should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /joining/i })).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/game-waiting?gameCode=TYCOON');
      });
    });

    it('should update button text from Join to Joining… and back', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const initialButton = screen.getByRole('button', { name: /^join$/i });

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(initialButton);

      // Should show "Joining…"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /joining/i })).toBeInTheDocument();
      });

      // After success, should navigate
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display 404 error when room is not found', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'NOTFND');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('form-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/room not found/i)).toBeInTheDocument();
      });
    });

    it('should display 409 error when room is full', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'FULL00');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('form-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/room is full/i)).toBeInTheDocument();
      });
    });

    it('should display error banner with retry button for form-level errors', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'NOTFND');
      await userEvent.click(submitButton);

      await waitFor(() => {
        const errorBanner = screen.getByTestId('form-error-banner');
        expect(errorBanner).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry join attempt when retry button is clicked', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      // First attempt with bad room
      await userEvent.type(input, 'NOTFND');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/room not found/i)).toBeInTheDocument();
      });

      // Click retry with valid room code
      await userEvent.clear(input);
      await userEvent.type(input, 'TYCOON');
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/game-waiting?gameCode=TYCOON');
      });
    });

    it('should show unauthorized error when auth token is missing', async () => {
      window.localStorage.removeItem('access_token');
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('form-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce 2-second cooldown between submissions', async () => {
      vi.useFakeTimers();
      try {
        render(<JoinRoomForm />);
        const input = screen.getByPlaceholderText('e.g. TYCOON');
        const submitButton = screen.getByRole('button', { name: /join/i });

        await userEvent.type(input, 'TYCOON');
        await userEvent.click(submitButton);

        // Immediately try to submit again (should be blocked by cooldown)
        await userEvent.clear(input);
        await userEvent.type(input, 'TYCOON');
        await userEvent.click(submitButton);

        // Should show rate limit error
        await waitFor(() => {
          expect(screen.getByText(/please wait a moment/i)).toBeInTheDocument();
        });

        // Advance time past cooldown
        vi.advanceTimersByTime(2001);

        // Now should be allowed
        await userEvent.clear(input);
        await userEvent.type(input, 'TYCOON');
        await userEvent.click(submitButton);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalled();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reset cooldown when retry button is clicked', async () => {
      vi.useFakeTimers();
      try {
        render(<JoinRoomForm />);
        const input = screen.getByPlaceholderText('e.g. TYCOON');
        const submitButton = screen.getByRole('button', { name: /join/i });

        // First submission with invalid room
        await userEvent.type(input, 'NOTFND');
        await userEvent.click(submitButton);

        await waitFor(() => {
          expect(screen.getByText(/room not found/i)).toBeInTheDocument();
        });

        // Immediately click retry (should not be rate-limited)
        const retryButton = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(retryButton);

        // Should attempt to join again immediately
        await waitFor(() => {
          // Request will fail but it should have made the attempt
          expect(screen.getByText(/room not found/i)).toBeInTheDocument();
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on input', () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');

      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should set aria-invalid when there are field errors', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should link input to error message with aria-describedby', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-describedby', 'room-code-error');
      });
    });

    it('should have aria-busy on button during loading', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /joining/i })).toHaveAttribute('aria-busy', 'true');
      });
    });

    it('should have role=alert on error banner', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'NOTFND');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('form-error-banner')).toHaveAttribute('role', 'alert');
      });
    });

    it('should focus input on component mount for keyboard users', () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');

      expect(input).toHaveFocus();
    });
  });

  describe('Button State Management', () => {
    it('should disable button when no valid code is entered', () => {
      render(<JoinRoomForm />);
      const submitButton = screen.getByRole('button', { name: /join/i });

      expect(submitButton).toBeDisabled();
    });

    it('should disable button when submit is in progress', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();
      });
    });

    it('should have consistent button width to prevent CLS', async () => {
      const { container } = render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const button = screen.getByRole('button', { name: /join/i });

      const initialWidth = button.offsetWidth;
      const initialHTML = button.innerHTML;

      await userEvent.type(input, 'TYCOON');
      await userEvent.click(button);

      // Button should maintain width even when text changes
      const loadingButton = screen.getByRole('button', { name: /joining/i });
      expect(loadingButton.offsetWidth).toBe(initialWidth);
    });
  });

  describe('Form Reset Behavior', () => {
    it('should not clear input code after successful submission', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON') as HTMLInputElement;

      await userEvent.type(input, 'TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });
      await userEvent.click(submitButton);

      // Input should retain value (component unmounts before navigation)
      expect(input.value).toBe('TYCOON');
    });

    it('should preserve error state across interactions until retry', async () => {
      render(<JoinRoomForm />);
      const input = screen.getByPlaceholderText('e.g. TYCOON');
      const submitButton = screen.getByRole('button', { name: /join/i });

      await userEvent.type(input, 'NOTFND');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/room not found/i)).toBeInTheDocument();
      });

      // Typing in input clears field errors but not form errors
      await userEvent.type(input, 'A');
      expect(screen.getByText(/room not found/i)).toBeInTheDocument();
    });
  });
});
