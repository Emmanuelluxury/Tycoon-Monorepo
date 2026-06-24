/**
 * SW-FE-040: NEAR wallet connect — MSW fixtures parity with API.
 *
 * Shapes match backend auth.controller wallet-login responses (camelCase).
 */

export const NEAR_WALLET_FIXTURE_ADDRESSES = {
  valid: 'player.testnet',
  invalid: 'invalid-wallet.near',
} as const;

export interface WalletLoginUserFixture {
  id: number;
  username: string;
  address: string;
  chain: string;
}

export interface WalletLoginSuccessResponse {
  accessToken: string;
  refreshToken: string;
  user: WalletLoginUserFixture;
}

export const mockNearWalletUser: WalletLoginUserFixture = {
  id: 1,
  username: 'near_player',
  address: NEAR_WALLET_FIXTURE_ADDRESSES.valid,
  chain: 'NEAR',
};

export const mockWalletLoginSuccess: WalletLoginSuccessResponse = {
  accessToken: 'mock-near-access-token',
  refreshToken: 'mock-near-refresh-token',
  user: mockNearWalletUser,
};

export const mockWalletLoginNotFound = {
  statusCode: 404,
  message: 'Invalid address/chain combination',
  error: 'Not Found',
};

export const mockWalletLoginBadRequest = {
  statusCode: 400,
  message: ['address should not be empty', 'chain should not be empty'],
  error: 'Bad Request',
};

export const mockAuthRefreshSuccess = {
  accessToken: 'mock-refreshed-access-token',
  refreshToken: 'mock-refreshed-refresh-token',
};
