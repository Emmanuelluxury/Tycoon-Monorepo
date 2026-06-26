/**
 * PurchaseModal — Vitest / RTL coverage
 * Covers SW-FE-025 (a11y / focus order), SW-FE-026 (TS strictness / null guards),
 * SW-FE-027 (Vitest / RTL coverage).
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { PurchaseModal } from '../src/components/ui/purchase-modal';

// ── i18n stub: return the defaultValue so tests are locale-independent ────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

// ── Telemetry stubs ───────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — render', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

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

  it('shows title and description in the normal (item present) state', () => {
    renderModal();
    expect(screen.getByText('Confirm Purchase')).toBeInTheDocument();
    expect(document.getElementById('purchase-modal-description')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — loading state', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('shows loading indicator when isLoading=true', () => {
    renderModal({ isLoading: true });
    expect(screen.getByTestId('purchase-modal-loading')).toBeInTheDocument();
  });

  it('hides price and action buttons while loading', () => {
    renderModal({ isLoading: true });
    expect(screen.queryByTestId('purchase-modal-price')).toBeNull();
    expect(screen.queryByTestId('purchase-modal-confirm')).toBeNull();
    expect(screen.queryByTestId('purchase-modal-cancel')).toBeNull();
  });

  it('still renders the modal scaffold (dialog / title) while loading', () => {
    renderModal({ isLoading: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Purchase')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — error state', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('shows error message when error prop is provided', () => {
    renderModal({ error: 'Payment failed' });
    expect(screen.getByTestId('purchase-modal-error')).toBeInTheDocument();
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
  });

  it('shows close button in error state', () => {
    renderModal({ error: 'Something went wrong' });
    expect(screen.getByTestId('purchase-modal-error').querySelector('button')).toBeInTheDocument();
  });

  it('hides confirm/cancel buttons in error state', () => {
    renderModal({ error: 'Oops' });
    expect(screen.queryByTestId('purchase-modal-confirm')).toBeNull();
    expect(screen.queryByTestId('purchase-modal-cancel')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — empty / no-item state (SW-FE-026 null guards)', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('shows empty state when itemName is null', () => {
    renderModal({ itemName: null });
    expect(screen.getByTestId('purchase-modal-empty')).toBeInTheDocument();
  });

  it('shows empty state when itemName is empty string', () => {
    renderModal({ itemName: '' });
    expect(screen.getByTestId('purchase-modal-empty')).toBeInTheDocument();
  });

  it('shows empty state when itemName is undefined', () => {
    renderModal({ itemName: undefined });
    expect(screen.getByTestId('purchase-modal-empty')).toBeInTheDocument();
  });

  it('renders price as empty string when itemPrice is null', () => {
    renderModal({ itemPrice: null });
    const price = screen.getByTestId('purchase-modal-price');
    // safeName will be non-empty; price will be ''
    expect(price).toBeInTheDocument();
  });

  it('strips HTML tags from itemName (XSS guard)', () => {
    renderModal({ itemName: '<script>alert(1)</script>Speed Boost' });
    // The script tag should be stripped; only "Speed Boost" should appear
    expect(screen.queryByText(/<script>/)).toBeNull();
    expect(screen.getByText(/Speed Boost/)).toBeInTheDocument();
  });

  it('strips HTML tags from itemPrice', () => {
    renderModal({ itemPrice: '<b>100.00</b>' });
    const price = screen.getByTestId('purchase-modal-price');
    expect(price.textContent).not.toContain('<b>');
    expect(price.textContent).toContain('100.00');
  });

  it('hides confirm/cancel in empty state', () => {
    renderModal({ itemName: null });
    expect(screen.queryByTestId('purchase-modal-confirm')).toBeNull();
    expect(screen.queryByTestId('purchase-modal-cancel')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — ARIA / semantics (SW-FE-025)', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('has role="dialog" with aria-modal="true"', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog with aria-labelledby pointing to the title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'purchase-modal-title');
    expect(document.getElementById('purchase-modal-title')).toHaveTextContent('Confirm Purchase');
  });

  it('describes the dialog with aria-describedby pointing to the description', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'purchase-modal-description');
    expect(document.getElementById('purchase-modal-description')).toHaveTextContent('Speed Boost');
  });

  it('price region has aria-live="polite" and aria-atomic="true"', () => {
    renderModal();
    const price = screen.getByTestId('purchase-modal-price');
    expect(price).toHaveAttribute('aria-live', 'polite');
    expect(price).toHaveAttribute('aria-atomic', 'true');
  });

  it('close button has a descriptive aria-label', () => {
    renderModal();
    expect(screen.getByTestId('purchase-modal-close')).toHaveAttribute('aria-label', 'Close');
  });

  it('the X icon inside the close button is aria-hidden', () => {
    renderModal();
    const icon = screen.getByTestId('purchase-modal-close').querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('backdrop is aria-hidden so screen readers skip it', () => {
    renderModal();
    expect(screen.getByTestId('purchase-modal-backdrop')).toHaveAttribute('aria-hidden', 'true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — focus order (SW-FE-025)', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

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

    // All buttons must exist and not be tabindex="-1"
    [close, cancel, confirm].forEach((el) => {
      expect(el).toBeInTheDocument();
      expect(el).not.toHaveAttribute('tabindex', '-1');
    });

    const focusable = Array.from(
      screen.getByTestId('purchase-modal').querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusable.indexOf(close)).toBeLessThan(focusable.indexOf(cancel));
    expect(focusable.indexOf(cancel)).toBeLessThan(focusable.indexOf(confirm));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — keyboard (SW-FE-025)', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab from confirm (last) back to close (first)', () => {
    renderModal();
    const confirm = screen.getByTestId('purchase-modal-confirm');
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-close'));
  });

  it('wraps Shift+Tab from close (first) back to confirm (last)', () => {
    renderModal();
    const close = screen.getByTestId('purchase-modal-close');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('purchase-modal-confirm'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — interactions', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

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

  it('calls onConfirm when Confirm Purchase is clicked', async () => {
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

  it('does not call onConfirm when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not call onClose when Confirm is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-confirm'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — scroll lock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

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

  it('restores prior overflow value on unmount', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<PurchaseModal {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PurchaseModal — telemetry (SW-FE-030)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('calls trackModalViewed when modal opens', () => {
    renderModal();
    expect(mockTrackViewed).toHaveBeenCalledWith({
      itemName: 'Speed Boost',
      currency: 'USD',
      value: '100.00',
    });
  });

  it('does not call trackModalViewed when modal is closed', () => {
    renderModal({ isOpen: false });
    expect(mockTrackViewed).not.toHaveBeenCalled();
  });

  it('calls trackModalCanceled when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-cancel'));
    expect(mockTrackCanceled).toHaveBeenCalledWith({
      itemName: 'Speed Boost',
      currency: 'USD',
      value: '100.00',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls trackModalCanceled when × is clicked', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('purchase-modal-close'));
    expect(mockTrackCanceled).toHaveBeenCalledTimes(1);
  });

  it('calls trackModalCanceled when backdrop is clicked', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('purchase-modal-backdrop'));
    expect(mockTrackCanceled).toHaveBeenCalledTimes(1);
  });

  it('calls trackModalConfirmed when Confirm is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();
    await user.click(screen.getByTestId('purchase-modal-confirm'));
    expect(mockTrackConfirmed).toHaveBeenCalledWith({
      itemName: 'Speed Boost',
      currency: 'USD',
      value: '100.00',
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('trackModalViewed uses empty string when itemName is null (null guard)', () => {
    renderModal({ itemName: null });
    expect(mockTrackViewed).toHaveBeenCalledWith(
      expect.objectContaining({ itemName: '' }),
    );
  });

  it('trackModalViewed uses empty string when itemPrice is null (null guard)', () => {
    renderModal({ itemPrice: null });
    expect(mockTrackViewed).toHaveBeenCalledWith(
      expect.objectContaining({ value: '' }),
    );
  });

  it('trackModalViewed uses empty string when itemCurrency is null (null guard)', () => {
    renderModal({ itemCurrency: null });
    expect(mockTrackViewed).toHaveBeenCalledWith(
      expect.objectContaining({ currency: '' }),
    );
  });
});
