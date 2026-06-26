/**
 * SW-FE-040: Auth MSW handlers — parity with /api/v1/auth endpoints.
 */

import { http, HttpResponse } from 'msw';
import {
  mockWalletLoginSuccess,
  mockWalletLoginNotFound,
  mockWalletLoginBadRequest,
  mockAuthRefreshSuccess,
  NEAR_WALLET_FIXTURE_ADDRESSES,
} from '../fixtures/near';

export const authHandlers = [
  // POST /api/v1/auth/wallet-login
  http.post('*/api/v1/auth/wallet-login', async ({ request }) => {
    let body: { address?: string; chain?: string } = {};
    try {
      body = (await request.json()) as { address?: string; chain?: string };
    } catch {
      return HttpResponse.json(mockWalletLoginBadRequest, { status: 400 });
    }

    if (!body.address?.trim() || !body.chain?.trim()) {
      return HttpResponse.json(mockWalletLoginBadRequest, { status: 400 });
    }

    if (body.address === NEAR_WALLET_FIXTURE_ADDRESSES.invalid) {
      return HttpResponse.json(mockWalletLoginNotFound, { status: 404 });
    }

    return HttpResponse.json({
      ...mockWalletLoginSuccess,
      user: {
        ...mockWalletLoginSuccess.user,
        address: body.address,
        chain: body.chain,
      },
    });
  }),

  // POST /api/v1/auth/refresh
  http.post('*/api/v1/auth/refresh', () => {
    return HttpResponse.json(mockAuthRefreshSuccess);
  }),

  // POST /api/v1/auth/logout
  http.post('*/api/v1/auth/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
