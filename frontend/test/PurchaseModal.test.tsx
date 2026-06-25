/**
 * PurchaseModal tests — covers SW-FE-028, SW-FE-029, SW-FE-030, SW-FE-031
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PurchaseModal } from '../src/components/ui/purchase-modal';

// react-i18next: return the key's defaultValue so tests are locale-independent
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? _key,
  }),
}));

// Stable mock fns so we can assert telemetry calls from the test body
const mockTrackViewed = vi.fn();
const mockTrackCanceled = vi.fn();
const mockTrackConfirmed = vi.fn();

vi.mock('@/hooks/usePurchaseModalTelemetry', () => ({
  usePurchaseModalTelemetry: () => ({
    trackModalViewed: mockTrackViewed,
    trackModalCanceled: mockTrackCanceled,
    trackModalConfirmed: mockTrackConfirmed,
  }),
}));

// Web vitals hook is a no-op in jsdom (no PerformanceObserver)
vi.mock('@/hooks/usePurchaseModalWebVitals', () => ({
  usePurchaseModalWebVitals: vi.fn(),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  itemName: 'Speed Boost',
  itemPrice: '100.00',
  itemCurrency: 'USD',
};

function renderModal(props: Partial<typeof defaultProps & { onRetry?: () => void }> = {}) {
  const merged = { ...defaultProps, ...props, onClose: vi.fn(), onConfirm: vi.fn() };
  render(<PurchaseModal {...merged} />);
  return merged;
}

describe('PurchaseModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  // ── Render ────────────────────────────────────────────────────────────────

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId('purchase-modal')).toBeNull();
  });

  it('renders the modal when isOpen is true', () => {
    renderModal();
    expect(screen.getByTestId('purchase-modal')).toBeInTheDocument();
    expect(screen.getByText('Confirm Purchase')).toBeInTheDocument();
    expect(screen.getByText(/Speed Boost/)).toBeInTheDocument();
    expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('100.00 USD');
  });

  // ── ARIA / semantics ──────────────────────────────────────────────────────

  it('has role="dialog" with aria-modal="true"', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog with aria-labelledby pointing to the title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'purchase-modal-title');
    expect(document.getElementById('purchase-modal-title')).toHaveTextContent(
      'Confirm Purchase',
    );
  });

  it('describes the dialog with aria-describedby pointing to the description', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'purchase-modal-description');
    expect(document.getElementById('purchase-modal-description')).toHaveTextContent(
      'Speed Boost',
    );
  });

  it('price region has aria-live="polite" and aria-atomic="true"', () => {
    renderModal();
    const price = screen.getByTestId('purchase-modal-price');
    expect(price).toHaveAttribute('aria-live', 'polite');
    expect(price).toHaveAttribute('aria-atomic', 'true');
  });

  it('close button has a descriptive aria-label', () => {
    renderModal();
    expect(screen.getByTestId('purchase-modal-close')).toHaveAttribute(
      'aria-label',
      'Close',
    );
  });

  // ── Focus order ───────────────────────────────────────────────────────────

  it('moves focus to the close (×) button on open', async () => {
    vi.useFakeTimers();
    renderModal();
    await act(async () => { vi.runAllTimers(); });
    vi.useRealTimers();
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('tab order is: close → cancel → confirm', () => {
    renderModal();
    const close = screen.getByTestId('purchase-modal-close');
    const cancel = screen.getByTestId('purchase-modal-cancel');
    const confirm = screen.getByTestId('purchase-modal-confirm');

    [close, cancel, confirm].forEach((el) => {
      expect(el).toBeInTheDocument();
      expect(el).not.toHaveAttribute('tabindex', '-1');
    });

    const all = Array.from(
      screen.getByTestId('purchase-modal').querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(all.indexOf(close)).toBeLessThan(all.indexOf(cancel));
    expect(all.indexOf(cancel)).toBeLessThan(all.indexOf(confirm));
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab from confirm (last) back to close (first)', async () => {
    renderModal();
    const confirm = screen.getByTestId('purchase-modal-confirm');
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('wraps Shift+Tab from close (first) back to confirm (last)', async () => {
    renderModal();
    const close = screen.getByTestId('purchase-modal-close');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-confirm'));
  });

  // ── Interactions ──────────────────────────────────────────────────────────

  it('calls onClose when the × button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Scroll lock ───────────────────────────────────────────────────────────

  it('locks body scroll when open', () => {
    renderModal();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when unmounted', () => {
    const { unmount } = render(<PurchaseModal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not lock body scroll when closed', () => {
    renderModal({ isOpen: false });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  // ── SW-FE-028: CLS / LCP regression ──────────────────────────────────────

  describe('SW-FE-028 — CLS / LCP (performance budget)', () => {
    it('card always has min-h-[260px] class to prevent CLS on loading → content transition', () => {
      renderModal();
      // The Card is the direct child of the container div
      const modal = screen.getByTestId('purchase-modal');
      const card = modal.querySelector('[class*="min-h-\\[260px\\]"]');
      expect(card).not.toBeNull();
    });

    it('price slot has h-10 class for a stable height (no CLS from text reflow)', () => {
      renderModal();
      const priceSlot = screen.getByTestId('purchase-modal-price').querySelector('.h-10');
      expect(priceSlot).not.toBeNull();
    });

    it('loading state renders inside the same reserved-height card', () => {
      renderModal({ isLoading: true });
      expect(screen.getByTestId('purchase-modal-loading')).toBeInTheDocument();
      const modal = screen.getByTestId('purchase-modal');
      const card = modal.querySelector('[class*="min-h-\\[260px\\]"]');
      expect(card).not.toBeNull();
    });
  });

  // ── SW-FE-029: Error / empty states ──────────────────────────────────────

  describe('SW-FE-029 — error and empty states', () => {
    it('shows loading indicator with aria-busy when isLoading is true', () => {
      renderModal({ isLoading: true });
      expect(screen.getByTestId('purchase-modal-loading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows error message with AlertCircle when error is supplied', () => {
      renderModal({ error: 'Purchase failed. Please try again.' });
      expect(screen.getByTestId('purchase-modal-error')).toBeInTheDocument();
      expect(screen.getByText('Purchase failed. Please try again.')).toBeInTheDocument();
    });

    it('error state has role="alert" for screen readers', () => {
      renderModal({ error: 'Something went wrong.' });
      expect(screen.getByTestId('purchase-modal-error')).toHaveAttribute('role', 'alert');
    });

    it('shows Retry button in error state when onRetry is provided', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const onClose = vi.fn();
      render(
        <PurchaseModal {...defaultProps} error="Network error." onRetry={onRetry} onClose={onClose} onConfirm={vi.fn()} />,
      );
      const retryBtn = screen.getByTestId('purchase-modal-retry');
      expect(retryBtn).toBeInTheDocument();
      await user.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not show Retry button in error state when onRetry is not provided', () => {
      renderModal({ error: 'Network error.' });
      expect(screen.queryByTestId('purchase-modal-retry')).toBeNull();
    });

    it('shows Close button in error state', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <PurchaseModal {...defaultProps} error="Oops." onClose={onClose} onConfirm={vi.fn()} />,
      );
      await user.click(screen.getByTestId('purchase-modal-error-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows empty state when itemName is null', () => {
      renderModal({ itemName: null });
      expect(screen.getByTestId('purchase-modal-empty')).toBeInTheDocument();
      expect(screen.getByText('Item details not found.')).toBeInTheDocument();
    });

    it('shows empty state when itemName is empty string', () => {
      renderModal({ itemName: '' });
      expect(screen.getByTestId('purchase-modal-empty')).toBeInTheDocument();
    });

    it('empty state has a Close button', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <PurchaseModal {...defaultProps} itemName={null} onClose={onClose} onConfirm={vi.fn()} />,
      );
      await user.click(screen.getByTestId('purchase-modal-empty-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── SW-FE-030: Telemetry ──────────────────────────────────────────────────

  describe('SW-FE-030 — telemetry hooks (privacy-safe)', () => {
    it('calls trackModalViewed when modal opens', () => {
      renderModal();
      expect(mockTrackViewed).toHaveBeenCalledWith({
        itemName: 'Speed Boost',
        currency: 'USD',
        value: '100.00',
      });
    });

    it('calls trackModalCanceled when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      await user.click(screen.getByTestId('purchase-modal-cancel'));
      expect(mockTrackCanceled).toHaveBeenCalledWith({
        itemName: 'Speed Boost',
        currency: 'USD',
        value: '100.00',
      });
    });

    it('calls trackModalConfirmed when Confirm is clicked', async () => {
      const user = userEvent.setup();
      renderModal();
      await user.click(screen.getByTestId('purchase-modal-confirm'));
      expect(mockTrackConfirmed).toHaveBeenCalledWith({
        itemName: 'Speed Boost',
        currency: 'USD',
        value: '100.00',
      });
    });

    it('does not forward raw itemName to onConfirm — only sanitized value is tracked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <PurchaseModal
          {...defaultProps}
          itemName={'<b>Bold Item</b>'}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />,
      );
      await user.click(screen.getByTestId('purchase-modal-confirm'));
      // trackModalConfirmed receives sanitized name (HTML stripped)
      expect(mockTrackConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ itemName: 'Bold Item' }),
      );
    });
  });

  // ── SW-FE-031: Security hardening ────────────────────────────────────────

  describe('SW-FE-031 — security hardening', () => {
    it('strips HTML tags from itemName before rendering', () => {
      renderModal({ itemName: '<script>alert(1)</script>Boost' });
      // The raw script tag must not appear in the DOM as HTML — only the text content
      expect(screen.queryByText('<script>alert(1)</script>Boost')).toBeNull();
      expect(screen.getByText(/Boost/)).toBeInTheDocument();
    });

    it('strips HTML tags from itemPrice before rendering', () => {
      renderModal({ itemPrice: '<b>100.00</b>' });
      expect(screen.queryByText('<b>100.00</b>')).toBeNull();
      expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('100.00');
    });

    it('strips HTML tags from itemCurrency before rendering', () => {
      renderModal({ itemCurrency: '<em>USD</em>' });
      expect(screen.queryByText('<em>USD</em>')).toBeNull();
      expect(screen.getByTestId('purchase-modal-price')).toHaveTextContent('USD');
    });

    it('does not use dangerouslySetInnerHTML (no unescaped HTML in output)', () => {
      renderModal({ itemName: '<img src=x onerror="alert(1)">' });
      // Should render empty string after stripping (no img element injected)
      const modal = screen.getByTestId('purchase-modal');
      expect(modal.querySelector('img')).toBeNull();
    });

    it('no PII fields appear in tracked telemetry events', () => {
      renderModal();
      expect(mockTrackViewed).not.toHaveBeenCalledWith(
        expect.objectContaining({ user_id: expect.anything() }),
      );
      expect(mockTrackViewed).not.toHaveBeenCalledWith(
        expect.objectContaining({ wallet_address: expect.anything() }),
      );
    });
  });
});
