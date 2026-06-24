import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { authHandlers } from '../src/mocks/handlers/auth';
import { mockNearWalletLoginResponse } from '../src/mocks/fixtures/near';

const BASE = 'http://localhost:3000';

const server = setupServer(...authHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── POST /auth/wallet-login ──────────────────────────────────────────────────

describe('POST /auth/wallet-login', () => {
  async function walletLogin(body: { address: string; chain: string }) {
    const res = await fetch(`${BASE}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it('returns 200 for valid NEAR wallet login', async () => {
    const { status } = await walletLogin({ address: 'test.near', chain: 'NEAR' });
    expect(status).toBe(200);
  });

  it('returns accessToken, refreshToken, user', async () => {
    const { body } = await walletLogin({ address: 'test.near', chain: 'NEAR' });
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('username');
    expect(body.user).toHaveProperty('address');
    expect(body.user).toHaveProperty('chain');
  });

  it('NEAR user reflects request address and fixture defaults', async () => {
    const { body } = await walletLogin({ address: 'player.testnet', chain: 'NEAR' });
    expect(body.user).toEqual({
      ...mockNearWalletLoginResponse.user,
      address: 'player.testnet',
    });
  });

  it('returns 400 for invalid NEAR account ID', async () => {
    const { status, body } = await walletLogin({ address: 'bad@near', chain: 'NEAR' });
    expect(status).toBe(400);
    expect(body.message).toMatch(/NEAR account ID/i);
  });

  it('returns 400 for missing address', async () => {
    const res = await fetch(`${BASE}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chain: 'NEAR' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid EVM wallet login', async () => {
    const { status, body } = await walletLogin({
      address: '0xAbCd1234EF567890',
      chain: 'BASE',
    });
    expect(status).toBe(200);
    expect(body.user.address).toBe('0xAbCd1234EF567890');
    expect(body.user.chain).toBe('BASE');
  });

  it('returns 400 for invalid EVM address', async () => {
    const { status } = await walletLogin({ address: 'not-evm', chain: 'BASE' });
    expect(status).toBe(400);
  });
});