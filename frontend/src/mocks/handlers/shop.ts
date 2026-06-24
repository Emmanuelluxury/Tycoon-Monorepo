import { http, HttpResponse } from 'msw';
import { mockInventory, mockPurchase, mockShopItems } from '../fixtures/shop';

const LIMIT = 20;

const SHOP_ITEMS_ERROR = {
  statusCode: 500,
  message: 'Failed to load shop items',
  error: 'Internal Server Error',
};

export const shopHandlers = [
  // GET /api/shop/items — paginated list
  http.get(/\/api\/shop\/items(\?.*)?$/, ({ request }) => {
    const url = new URL(request.url);

    if (url.searchParams.get('error') === 'true') {
      return HttpResponse.json(SHOP_ITEMS_ERROR, { status: 500 });
    }

    const items =
      url.searchParams.get('empty') === 'true' ? [] : mockShopItems;

    return HttpResponse.json({
      data: items,
      total: items.length,
      page: 1,
      limit: LIMIT,
    });
  }),

  // GET /api/shop/inventory — authenticated user's inventory
  http.get(/\/api\/shop\/inventory/, () => {
    return HttpResponse.json(mockInventory);
  }),

  // POST /api/shop/purchase — create a purchase (201)
  http.post(/\/api\/shop\/purchase/, () => {
    return HttpResponse.json(mockPurchase, { status: 201 });
  }),

  // GET /api/shop/purchases — purchase history
  http.get(/\/api\/shop\/purchases/, () => {
    return HttpResponse.json([mockPurchase]);
  }),

  // POST /api/shop/gift — gift purchase (201)
  http.post(/\/api\/shop\/gift/, () => {
    return HttpResponse.json({ ...mockPurchase, is_gift: true }, { status: 201 });
  }),
];
