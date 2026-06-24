/**
 * NEAR wallet auth fixtures — aligned with POST /auth/wallet-login MSW handler.
 * SW-FE-040: MSW fixtures parity with API.
 */

export interface MockWalletLoginUser {
  id: number;
  username: string;
  address: string;
  chain: string;
}

export interface MockWalletLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: MockWalletLoginUser;
}

export const mockNearWalletLoginResponse: MockWalletLoginResponse = {
  accessToken: "mock-near-access-token",
  refreshToken: "mock-near-refresh-token",
  user: {
    id: 1,
    username: "nearPlayer",
    address: "test.near",
    chain: "NEAR",
  },
};

export const mockEvmWalletLoginResponse: MockWalletLoginResponse = {
  accessToken: "mock-evm-access-token",
  refreshToken: "mock-evm-refresh-token",
  user: {
    id: 2,
    username: "evmPlayer",
    address: "0xAbCd1234EF567890",
    chain: "BASE",
  },
};

export const NEAR_CHAIN_IDS = ["NEAR", "near"] as const;
