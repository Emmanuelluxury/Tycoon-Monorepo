import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { authHandlers } from '../src/mocks/handlers/auth';
import {
  mockWalletLoginSuccess,
  NEAR_WALLET_FIXTURE_ADDRESSES,
} from '../src/mocks/fixtures/near';

const BASE = 'http://localhost:3000/api/v1';

const server = setupServer(...authHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('POST /api/v1/auth/wallet-login', () => {
  async function walletLogin(body: { address: string; chain: string }) {
    const res = await fetch(`${BASE}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { res, body: await res.json() };
  }

  it('returns 200', async () => {
    const { res } = await walletLogin({
      address: NEAR_WALLET_FIXTURE_ADDRESSES.valid,
      chain: 'NEAR',
    });
    expect(res.status).toBe(200);
  });

  it('returns accessToken, refreshToken, user', async () => {
    const { body } = await walletLogin({
      address: NEAR_WALLET_FIXTURE_ADDRESSES.valid,
      chain: 'NEAR',
    });
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('username');
    expect(body.user).toHaveProperty('address');
    expect(body.user).toHaveProperty('chain');
  });

  it('user reflects submitted wallet address', async () => {
    const { body } = await walletLogin({
      address: NEAR_WALLET_FIXTURE_ADDRESSES.valid,
      chain: 'NEAR',
    });
    expect(body.user.address).toBe(NEAR_WALLET_FIXTURE_ADDRESSES.valid);
    expect(body.user.username).toBe(mockWalletLoginSuccess.user.username);
  });
});
