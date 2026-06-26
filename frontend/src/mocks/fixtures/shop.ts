import type { ShopItemResponse, UserInventoryResponse, PurchaseResponse } from '@/lib/api/types/dto';

export const mockShopItems: ShopItemResponse[] = [
  {
    id: 1,
    name: 'Speed Boost',
    description: 'Move 2 spaces forward',
    type: 'dice',
    price: '100.00',
    currency: 'USD',
    metadata: { imageUrl: '/game/boost-speed.svg' },
    rarity: 'common',
    active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Get Out of Jail Free',
    description: 'Escape jail without paying',
    type: 'card',
    price: '500.00',
    currency: 'USD',
    metadata: { imageUrl: '/game/gotojail.svg' },
    rarity: 'rare',
    active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Roll Again',
    description: 'Roll dice again',
    type: 'dice',
    price: '200.00',
    currency: 'USD',
    metadata: null,
    rarity: 'common',
    active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
];

export const mockInventory: UserInventoryResponse[] = [
  {
    id: 1,
    user_id: 1,
    shop_item_id: 1,
    shop_item: mockShopItems[0],
    quantity: 3,
    expires_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    user_id: 1,
    shop_item_id: 2,
    shop_item: mockShopItems[1],
    quantity: 1,
    expires_at: '2025-12-31T23:59:59.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
];

export const mockPurchase: PurchaseResponse = {
  id: 99,
  user_id: 1,
  shop_item_id: 1,
  shop_item: mockShopItems[0],
  quantity: 1,
  unit_price: '100.00',
  total_price: '100.00',
  original_price: '100.00',
  discount_amount: '0.00',
  final_price: '100.00',
  coupon_code: null,
  currency: 'USD',
  payment_method: 'balance',
  transaction_id: null,
  status: 'completed',
  is_gift: false,
  created_at: new Date().toISOString(),
};

// SW-FE-032: purchase-by-id fixture (mirrors GET /api/shop/purchases/:id)
export const mockPurchaseById: PurchaseResponse = {
  ...mockPurchase,
  id: 42,
  shop_item_id: 2,
  shop_item: mockShopItems[1],
  unit_price: '500.00',
  total_price: '500.00',
  original_price: '500.00',
  final_price: '500.00',
  status: 'completed',
};

/**
 * SW-FE-032: Idempotency-key replay fixture — same shape as mockPurchase but
 * with a stable created_at so the fixture is deterministic in snapshots.
 */
export const mockIdempotentPurchase: PurchaseResponse = {
  ...mockPurchase,
  id: 101,
  transaction_id: 'idem-abc123',
  created_at: '2024-06-01T12:00:00.000Z',
};
