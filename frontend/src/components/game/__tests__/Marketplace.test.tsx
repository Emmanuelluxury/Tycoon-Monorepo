import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Marketplace } from '../Marketplace';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'react-toastify';

// Mock dependencies
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the PurchaseModal component since it's used by Marketplace
vi.mock('@/components/ui/purchase-modal', () => ({
  PurchaseModal: ({ isOpen, onConfirm, itemName }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="purchase-modal">
        <button onClick={onConfirm}>Confirm Purchase of {itemName}</button>
      </div>
    );
  },
}));

// Mock the Spinner component (legacy — Marketplace now uses ShopGrid)
vi.mock('@/components/ui/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

vi.mock('@/hooks/useShopTelemetry', () => ({
  useShopTelemetry: () => ({
    trackGridViewed: vi.fn(),
    trackItemImpression: vi.fn(),
    trackPurchaseInitiated: vi.fn(),
  }),
}));

// Helper to mock fetch responses
const mockFetch = (data: any, ok = true, status = 200) => {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
    })
  );
};

describe('Marketplace Optimistic UI', () => {
  const mockItems = [
    {
      id: 1,
      name: 'Cool Skin',
      description: 'A very cool skin',
      type: 'skin',
      price: '100',
      currency: 'GOLD',
      rarity: 'rare',
      is_owned: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch({ data: mockItems });
  });

  it('performs an optimistic update and reverts on failure', async () => {
    // 1. Initial render - fetch items
    render(<Marketplace />);
    
    // Wait for items to load
    await waitFor(() => expect(screen.getByTestId('shop-grid-items')).toBeInTheDocument());
    expect(screen.getByText('Cool Skin')).toBeInTheDocument();
    
    const buyButton = screen.getByLabelText('Buy Cool Skin');
    expect(buyButton).not.toBeDisabled();

    fireEvent.click(buyButton);
    
    // 3. Mock a failed purchase response for the next fetch call
    global.fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Insufficient funds' }),
      }))
      // Subsequent fetch for items should return original items
      .mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: mockItems }),
      }));

    // 4. Confirm purchase in the modal
    const confirmButton = screen.getByText('Confirm Purchase of Cool Skin');
    fireEvent.click(confirmButton);

    // 5. CHECK OPTIMISTIC UI: The button should IMMEDIATELY show "Owned" (or equivalent state change)
    // before the fetch completes
    expect(screen.getByTestId('shop-item-buy-1')).toBeDisabled();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
      expect(toast.error.mock.calls[0]?.[0]).toBe('Insufficient funds');
      expect(screen.getByTestId('shop-item-buy-1')).not.toBeDisabled();
    });
    
    expect(screen.getByLabelText('Buy Cool Skin')).toBeInTheDocument();
  });

  it('performs an optimistic update and stays successful on server success', async () => {
    render(<Marketplace />);
    await waitFor(() => expect(screen.getByTestId('shop-grid-items')).toBeInTheDocument());
    
    const buyButton = screen.getByLabelText('Buy Cool Skin');
    fireEvent.click(buyButton);

    // Mock successful purchase
    global.fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 101, status: 'completed' }),
      }))
      .mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ ...mockItems[0], is_owned: true }] }),
      }));

    const confirmButton = screen.getByText('Confirm Purchase of Cool Skin');
    fireEvent.click(confirmButton);

    // Optimistic update
    expect(screen.getByTestId('shop-item-buy-1')).toBeDisabled();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(toast.success.mock.calls[0]?.[0]).toBe(
        'Cool Skin purchased successfully!',
      );
      expect(screen.getByTestId('shop-item-buy-1')).toBeDisabled();
    });
  });

  it('shows error state with retry when fetch fails (SW-FE-021)', async () => {
    global.fetch = mockFetch({ message: 'Server error' }, false, 500);
    render(<Marketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('shop-grid-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('shop-grid-retry-button')).toBeInTheDocument();
  });

  it('shows empty state when API returns no items (SW-FE-021)', async () => {
    global.fetch = mockFetch({ data: [] });
    render(<Marketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('shop-grid-empty')).toBeInTheDocument();
    });
  });
});
