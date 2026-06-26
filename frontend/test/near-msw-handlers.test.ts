/**
 * SW-FE-040: NEAR wallet connect — MSW fixtures parity with API tests.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { authHandlers } from '../src/mocks/handlers/auth';
import {
  mockWalletLoginSuccess,
  mockWalletLoginNotFound,
  mockWalletLoginBadRequest,
  mockAuthRefreshSuccess,
  NEAR_WALLET_FIXTURE_ADDRESSES,
} from '../src/mocks/fixtures/near';

const BASE = 'http://localhost:3000/api/v1';

const server = setupServer(...authHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SW-FE-040: NEAR wallet MSW handlers — parity with API', () => {
  describe('POST /api/v1/auth/wallet-login', () => {
    it('returns 200 with accessToken, refreshToken, and user', async () => {
      const res = await fetch(`${BASE}/auth/wallet-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: NEAR_WALLET_FIXTURE_ADDRESSES.valid,
          chain: 'NEAR',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('user');
      expect(body.user.address).toBe(NEAR_WALLET_FIXTURE_ADDRESSES.valid);
      expect(body.user.chain).toBe('NEAR');
    });

    it('user shape matches backend contract', async () => {
      const res = await fetch(`${BASE}/auth/wallet-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: NEAR_WALLET_FIXTURE_ADDRESSES.valid,
          chain: 'NEAR',
        }),
      });
      const body = await res.json();
      expect(body.user).toMatchObject({
        id: mockWalletLoginSuccess.user.id,
        username: mockWalletLoginSuccess.user.username,
      });
    });

    it('returns 404 for invalid fixture address', async () => {
      const res = await fetch(`${BASE}/auth/wallet-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: NEAR_WALLET_FIXTURE_ADDRESSES.invalid,
          chain: 'NEAR',
        }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual(mockWalletLoginNotFound);
    });

    it('returns 400 when address or chain is missing', async () => {
      const res = await fetch(`${BASE}/auth/wallet-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '', chain: 'NEAR' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.statusCode).toBe(mockWalletLoginBadRequest.statusCode);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns refreshed tokens', async () => {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'mock-refresh-token' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockAuthRefreshSuccess);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('returns 204', async () => {
      const res = await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
      });
      expect(res.status).toBe(204);
    });
  });
});
