import { http, HttpResponse } from 'msw';
import { isValidNearAccountId } from '@/lib/near/config';
import { walletLoginSchema } from '@/lib/validation/schemas';
import {
  mockEvmWalletLoginResponse,
  mockNearWalletLoginResponse,
  NEAR_CHAIN_IDS,
} from '@/mocks/fixtures/near';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{1,100}$/;

export const authHandlers = [
  http.post('/auth/wallet-login', async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = walletLoginSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        {
          message: 'Validation failed',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { address, chain } = parsed.data;
    const normalizedChain = chain.trim().toUpperCase();

    if (NEAR_CHAIN_IDS.map((c) => c.toUpperCase()).includes(normalizedChain)) {
      if (!isValidNearAccountId(address)) {
        return HttpResponse.json(
          { message: 'address must be a valid NEAR account ID' },
          { status: 400 },
        );
      }
      return HttpResponse.json({
        ...mockNearWalletLoginResponse,
        user: {
          ...mockNearWalletLoginResponse.user,
          address,
          chain: 'NEAR',
        },
      });
    }

    if (!EVM_ADDRESS_RE.test(address)) {
      return HttpResponse.json(
        { message: 'address must be a valid hex wallet address starting with 0x' },
        { status: 400 },
      );
    }

    return HttpResponse.json({
      ...mockEvmWalletLoginResponse,
      user: {
        ...mockEvmWalletLoginResponse.user,
        address,
        chain: normalizedChain,
      },
    });
  }),
];
