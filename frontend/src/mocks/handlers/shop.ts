import { http, HttpResponse } from 'msw';
import {
  mockInventory,
  mockPurchase,
  mockPurchaseById,
  mockIdempotentPurchase,
  mockShopItems,
} from '../fixtures/shop';

const LIMIT = 20;

/**
 * SW-FE-032: In-memory idempotency store.
 * Maps Idempotency-Key header → cached PurchaseResponse so that replaying the
 * same key returns the stored result (matching the real API contract).
 */
const idempotencyCache = new Map<string, object>();

export const shopHandlers = [
  // GET /api/shop/items — paginated list
  http.get(/\/api\/shop\/items(\?.*)?$/, () => {
    return HttpResponse.json({
      data: mockShopItems,
      total: mockShopItems.length,
      page: 1,
      limit: LIMIT,
    });
  }),

  // GET /api/shop/inventory — authenticated user's inventory
  http.get(/\/api\/shop\/inventory/, () => {
    return HttpResponse.json(mockInventory);
  }),

  // SW-FE-032: GET /api/shop/purchases/:id — single purchase by id
  http.get(/\/api\/shop\/purchases\/(\d+)$/, ({ params }) => {
    const id = Number(params['0'] ?? (params as Record<string, string>)['id']);
    if (id === mockPurchaseById.id) {
      return HttpResponse.json(mockPurchaseById);
    }
    if (id === mockPurchase.id) {
      return HttpResponse.json(mockPurchase);
    }
    return HttpResponse.json({ message: 'Purchase not found' }, { status: 404 });
  }),

  // GET /api/shop/purchases — purchase history (must come after the /:id route)
  http.get(/\/api\/shop\/purchases$/, () => {
    return HttpResponse.json([mockPurchase, mockPurchaseById]);
  }),

  // SW-FE-032: POST /api/shop/purchase — create a purchase with idempotency-key parity (201)
  http.post(/\/api\/shop\/purchase/, ({ request }) => {
    const idemKey = request.headers.get('Idempotency-Key');
    if (idemKey) {
      const cached = idempotencyCache.get(idemKey);
      if (cached) {
        // Replay cached response — same semantics as the backend (200 replay)
        return HttpResponse.json(cached, { status: 200 });
      }
      const result = { ...mockIdempotentPurchase, transaction_id: idemKey };
      idempotencyCache.set(idemKey, result);
      return HttpResponse.json(result, { status: 201 });
    }
    return HttpResponse.json(mockPurchase, { status: 201 });
  }),

  // POST /api/shop/gift — gift purchase (201)
  http.post(/\/api\/shop\/gift/, () => {
    return HttpResponse.json({ ...mockPurchase, is_gift: true }, { status: 201 });
  }),
];

/** SW-FE-032: Reset idempotency store between tests. */
export function resetIdempotencyCache(): void {
  idempotencyCache.clear();
}
