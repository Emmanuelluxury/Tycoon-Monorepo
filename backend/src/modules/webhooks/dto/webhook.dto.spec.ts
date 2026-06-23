import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StripeWebhookDto } from './webhook.dto';

describe('StripeWebhookDto validation (SW-BE-020)', () => {
  async function getErrors(payload: object) {
    const dto = plainToInstance(StripeWebhookDto, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  }

  it('accepts a valid Stripe webhook payload', async () => {
    const errors = await getErrors({
      id: 'evt_123',
      type: 'charge.succeeded',
      data: { object: 'charge' },
      created: 1680000000,
      livemode: false,
      api_version: '2024-01-01',
      request: { id: 'req_123' },
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid livemode and non-integer created timestamp', async () => {
    const errors = await getErrors({
      id: 'evt_123',
      type: 'charge.succeeded',
      data: { object: 'charge' },
      created: 'not-a-number',
      livemode: 'not-a-bool',
      api_version: '2024-01-01',
    });

    expect(errors.some((message) => /livemode/i.test(message))).toBe(true);
    expect(errors.some((message) => /created/i.test(message))).toBe(true);
  });

  it('rejects missing required webhook fields', async () => {
    const errors = await getErrors({
      type: 'charge.succeeded',
      data: {},
      created: 1680000000,
      livemode: true,
    });

    expect(errors.some((message) => /id/i.test(message))).toBe(true);
    expect(errors.some((message) => /data/i.test(message))).toBe(true);
  });

  it('allows a missing optional request object', async () => {
    const errors = await getErrors({
      id: 'evt_123',
      type: 'charge.succeeded',
      data: { object: 'charge' },
      created: 1680000000,
      livemode: true,
      api_version: '2024-01-01',
    });

    expect(errors).toHaveLength(0);
  });
});
