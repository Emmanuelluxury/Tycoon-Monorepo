/**
 * SW-BE-029 — Webhooks & signatures env validation regression tests.
 * Keeps Joi requirements for WEBHOOK_SECRET, signature tolerance, and idempotency TTL aligned with webhooks.service.ts expectations.
 */
import { validationSchema } from './env.validation';

/** Minimal valid payload for development-shaped validation (required DB + JWT defaults). */
function minimalDevEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'development',
    DB_USERNAME: 'tycoon',
    DB_PASSWORD: 'tycoon',
    DB_DATABASE: 'tycoon',
    ...overrides,
  };
}

describe('env.validation — Webhooks (SW-BE-029)', () => {
  describe('WEBHOOK_SECRET', () => {
    it('should be required in production', () => {
      const config = {
        NODE_ENV: 'production',
        DB_USERNAME: 'user',
        DB_PASSWORD: 'pass',
        DB_DATABASE: 'db',
      };
      const { error } = validationSchema.validate(config, { abortEarly: false });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_SECRET/);
    });

    it('should enforce minimum length of 16 characters in production', () => {
      const config = {
        NODE_ENV: 'production',
        DB_USERNAME: 'user',
        DB_PASSWORD: 'pass',
        DB_DATABASE: 'db',
        WEBHOOK_SECRET: 'short', // too short
      };
      const { error } = validationSchema.validate(config, { abortEarly: false });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_SECRET/);
    });

    it('should accept 16+ character secrets in production', () => {
      const { error, value } = validationSchema.validate(
        {
          NODE_ENV: 'production',
          DB_USERNAME: 'user',
          DB_PASSWORD: 'pass',
          DB_DATABASE: 'db',
          WEBHOOK_SECRET: 'a'.repeat(16),
        },
        { abortEarly: false },
      );
      expect(error).toBeUndefined();
      expect(value.WEBHOOK_SECRET).toBe('a'.repeat(16));
    });

    it('should use default in development', () => {
      const { value, error } = validationSchema.validate(minimalDevEnv(), {
        abortEarly: false,
      });
      expect(error).toBeUndefined();
      expect(value.WEBHOOK_SECRET).toBe('dev-only-insecure-secret-change-me');
    });

    it('should allow override in development', () => {
      const { value, error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_SECRET: 'custom-dev-secret' }),
        { abortEarly: false },
      );
      expect(error).toBeUndefined();
      expect(value.WEBHOOK_SECRET).toBe('custom-dev-secret');
    });
  });

  describe('WEBHOOK_SIGNATURE_TOLERANCE_SECONDS', () => {
    it('should have default of 300 seconds', () => {
      const { value } = validationSchema.validate(minimalDevEnv(), {
        abortEarly: false,
      });
      expect(value.WEBHOOK_SIGNATURE_TOLERANCE_SECONDS).toBe(300);
    });

    it('should enforce minimum of 10 seconds', () => {
      const { error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: 5 }),
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_SIGNATURE_TOLERANCE_SECONDS/);
    });

    it('should enforce maximum of 3600 seconds', () => {
      const { error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: 3601 }),
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_SIGNATURE_TOLERANCE_SECONDS/);
    });

    it('should accept values within range', () => {
      const { value, error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: 600 }),
        { abortEarly: false },
      );
      expect(error).toBeUndefined();
      expect(value.WEBHOOK_SIGNATURE_TOLERANCE_SECONDS).toBe(600);
    });

    it('should require integer', () => {
      const { error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: 300.5 }),
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_SIGNATURE_TOLERANCE_SECONDS/);
    });
  });

  describe('WEBHOOK_IDEMPOTENCY_TTL_DAYS', () => {
    it('should have default of 7 days', () => {
      const { value } = validationSchema.validate(minimalDevEnv(), {
        abortEarly: false,
      });
      expect(value.WEBHOOK_IDEMPOTENCY_TTL_DAYS).toBe(7);
    });

    it('should enforce minimum of 1 day', () => {
      const { error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_IDEMPOTENCY_TTL_DAYS: 0 }),
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_IDEMPOTENCY_TTL_DAYS/);
    });

    it('should enforce maximum of 365 days', () => {
      const { error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_IDEMPOTENCY_TTL_DAYS: 366 }),
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_IDEMPOTENCY_TTL_DAYS/);
    });

    it('should accept values within range', () => {
      const { value, error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_IDEMPOTENCY_TTL_DAYS: 30 }),
        { abortEarly: false },
      );
      expect(error).toBeUndefined();
      expect(value.WEBHOOK_IDEMPOTENCY_TTL_DAYS).toBe(30);
    });

    it('should require integer', () => {
      const { error } = validationSchema.validate(
        minimalDevEnv({ WEBHOOK_IDEMPOTENCY_TTL_DAYS: 7.5 }),
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/WEBHOOK_IDEMPOTENCY_TTL_DAYS/);
    });
  });

  describe('PAYMENT_WEBHOOK_SECRET', () => {
    it('should be required in production', () => {
      const { error } = validationSchema.validate(
        {
          NODE_ENV: 'production',
          DB_USERNAME: 'user',
          DB_PASSWORD: 'pass',
          DB_DATABASE: 'db',
          WEBHOOK_SECRET: 'a'.repeat(16),
        },
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/PAYMENT_WEBHOOK_SECRET/);
    });

    it('should enforce minimum length of 16 characters in production', () => {
      const { error } = validationSchema.validate(
        {
          NODE_ENV: 'production',
          DB_USERNAME: 'user',
          DB_PASSWORD: 'pass',
          DB_DATABASE: 'db',
          WEBHOOK_SECRET: 'a'.repeat(16),
          PAYMENT_WEBHOOK_SECRET: 'short',
        },
        { abortEarly: false },
      );
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/PAYMENT_WEBHOOK_SECRET/);
    });
  });
});
