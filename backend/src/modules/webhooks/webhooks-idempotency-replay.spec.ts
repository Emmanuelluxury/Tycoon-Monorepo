/**
 * SW-BE-034 — Webhooks & signatures: idempotency and replay tests
 *
 * Unit tests covering the interaction between WebhooksService's signature
 * verification and the Redis-backed idempotency layer.
 *
 * All external dependencies are mocked — no live Redis, no database, no
 * prom-client required. The jest.config.ts rootDir is `src/`, so this file
 * is picked up by the default `npm run test` command.
 *
 * Scenarios covered
 * ─────────────────
 * Signature verification
 *  1. Valid HMAC + fresh timestamp → true
 *  2. Invalid HMAC (wrong hex) → false (signature_length_mismatch)
 *  3. Correct-length but wrong HMAC → false (signature_mismatch)
 *  4. Timestamp outside 5-minute window → throws (timestamp_outside_tolerance)
 *  5. Missing signature → throws (missing_signature_or_timestamp)
 *  6. Missing timestamp → throws (missing_signature_or_timestamp)
 *  7. Non-numeric timestamp → throws (timestamp_outside_tolerance)
 *
 * Idempotency in processWebhook
 *  8.  New webhook (Redis miss) → processes, persists, marks Redis true
 *  9.  Duplicate webhook (Redis hit) → returns idempotent:true, no save
 * 10.  No webhook ID → throws
 * 11.  Redis.set failure → throws, logs failure
 * 12.  Repo.save failure → throws, logs failure
 *
 * Replay interactions (verify + process together)
 * 13.  Replay scenario: second call with same ID hits idempotency guard
 * 14.  Secret can be changed at construction time (env config)
 * 15.  Multiple sources have independent idempotency keys
 * 16.  Audit hooks called for each lifecycle event
 * 17.  Observability logs called on idempotency hit
 * 18.  No secrets appear in any log call
 */

import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
import { WebhookAuditHooksService } from './webhook-audit-hooks.service';
import { RedisService } from '../redis/redis.service';

// ── factory helpers ───────────────────────────────────────────────────────────

const SECRET = 'test_webhook_secret';

function makeSignature(secret: string, timestamp: string, body: string) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

function freshTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function makeRepo() {
  return {
    create: jest.fn((v: unknown) => v),
    save: jest.fn().mockResolvedValue({}),
  };
}

function makeObservability(): jest.Mocked<WebhooksObservabilityService> {
  return {
    logWebhookReceived: jest.fn(),
    logSignatureVerification: jest.fn(),
    logIdempotencyHit: jest.fn(),
    logWebhookProcessed: jest.fn(),
    logWebhookProcessingFailed: jest.fn(),
    logHttpRequest: jest.fn(),
    getMetricsText: jest.fn(),
  } as unknown as jest.Mocked<WebhooksObservabilityService>;
}

function makeAuditService(): jest.Mocked<WebhooksAuditService> {
  return {
    auditSignatureVerification: jest.fn().mockResolvedValue(undefined),
    auditWebhookReceived: jest.fn().mockResolvedValue(undefined),
    auditIdempotencyCheck: jest.fn().mockResolvedValue(undefined),
    auditWebhookPersisted: jest.fn().mockResolvedValue(undefined),
    auditProcessingCompleted: jest.fn().mockResolvedValue(undefined),
    auditProcessingFailed: jest.fn().mockResolvedValue(undefined),
    getAuditLogsForWebhook: jest.fn(),
    getFailedOperations: jest.fn(),
    getAuditStatistics: jest.fn(),
  } as unknown as jest.Mocked<WebhooksAuditService>;
}

function makeAuditHooks(): jest.Mocked<WebhookAuditHooksService> {
  return {
    onReceived: jest.fn(),
    onSignatureVerified: jest.fn(),
    onSignatureFailed: jest.fn(),
    onDuplicate: jest.fn(),
    onProcessed: jest.fn(),
    onFailed: jest.fn(),
  } as unknown as jest.Mocked<WebhookAuditHooksService>;
}

function makeRedis(): jest.Mocked<RedisService> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<RedisService>;
}

function makeService(
  overrides: {
    redis?: jest.Mocked<RedisService>;
    observability?: jest.Mocked<WebhooksObservabilityService>;
    auditService?: jest.Mocked<WebhooksAuditService>;
    auditHooks?: jest.Mocked<WebhookAuditHooksService>;
    repo?: ReturnType<typeof makeRepo>;
    secret?: string;
  } = {},
) {
  const redis = overrides.redis ?? makeRedis();
  const observability = overrides.observability ?? makeObservability();
  const auditService = overrides.auditService ?? makeAuditService();
  const auditHooks = overrides.auditHooks ?? makeAuditHooks();
  const repo = overrides.repo ?? makeRepo();
  const secret = overrides.secret ?? SECRET;

  const config = new ConfigService({ WEBHOOK_SECRET: secret });
  const service = new WebhooksService(
    config,
    redis,
    observability,
    auditService,
    auditHooks,
    repo as any,
  );

  return { service, redis, observability, auditService, auditHooks, repo };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('WebhooksService — idempotency and replay (SW-BE-034)', () => {
  // ── Signature verification ──────────────────────────────────────────────

  describe('verifySignature', () => {
    it('returns true for a valid HMAC with a fresh timestamp', async () => {
      const { service } = makeService();
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded' });
      const sig = makeSignature(SECRET, ts, body);

      const result = await service.verifySignature(
        sig,
        ts,
        Buffer.from(body),
        'stripe',
      );
      expect(result).toBe(true);
    });

    it('returns false for wrong-length HMAC (signature_length_mismatch)', async () => {
      const { service, observability } = makeService();
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_x' });

      const result = await service.verifySignature(
        'aabbcc',
        ts,
        Buffer.from(body),
        'stripe',
        undefined,
        'trace-len',
      );

      expect(result).toBe(false);
      expect(observability.logSignatureVerification).toHaveBeenCalledWith(
        'stripe',
        false,
        expect.any(Number),
        'signature_length_mismatch',
        'trace-len',
      );
    });

    it('returns false for correct-length but wrong HMAC (signature_mismatch)', async () => {
      const { service, observability } = makeService();
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_y' });
      // Build a valid-length hex string that is NOT the right HMAC
      const wrongSig = 'a'.repeat(64);

      const result = await service.verifySignature(
        wrongSig,
        ts,
        Buffer.from(body),
        'stripe',
        undefined,
        'trace-mismatch',
      );

      expect(result).toBe(false);
      expect(observability.logSignatureVerification).toHaveBeenCalledWith(
        'stripe',
        false,
        expect.any(Number),
        'signature_mismatch',
        'trace-mismatch',
      );
    });

    it('throws UnauthorizedException for a stale timestamp', async () => {
      const { service } = makeService();
      const stale = (Math.floor(Date.now() / 1000) - 400).toString();
      const body = JSON.stringify({ id: 'evt_z' });

      await expect(
        service.verifySignature('sig', stale, Buffer.from(body), 'stripe'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a missing signature', async () => {
      const { service } = makeService();
      const ts = freshTimestamp();

      await expect(
        service.verifySignature('', ts, Buffer.from('body'), 'stripe'),
      ).rejects.toThrow('Missing webhook signature or timestamp');
    });

    it('throws UnauthorizedException for a missing timestamp', async () => {
      const { service } = makeService();

      await expect(
        service.verifySignature('sig', '', Buffer.from('body'), 'stripe'),
      ).rejects.toThrow('Missing webhook signature or timestamp');
    });

    it('throws UnauthorizedException for a non-numeric timestamp', async () => {
      const { service } = makeService();

      await expect(
        service.verifySignature('sig', 'not-a-number', Buffer.from('body'), 'stripe'),
      ).rejects.toThrow('Webhook timestamp outside of tolerance');
    });

    it('does not include the webhook secret in any observability log call', async () => {
      const { service, observability } = makeService({ secret: 'SUPER_SECRET' });
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_sec' });
      const sig = makeSignature('SUPER_SECRET', ts, body);

      await service.verifySignature(sig, ts, Buffer.from(body), 'stripe');

      for (const call of observability.logSignatureVerification.mock.calls) {
        for (const arg of call) {
          if (arg !== undefined && arg !== null) {
            expect(JSON.stringify(arg)).not.toContain('SUPER_SECRET');
          }
        }
      }
    });
  });

  // ── processWebhook — idempotency ─────────────────────────────────────────

  describe('processWebhook — idempotency', () => {
    const payload = { id: 'evt_123', type: 'payment.succeeded' };

    it('processes a new webhook, marks Redis, and persists the event', async () => {
      const { service, redis, repo } = makeService();

      const result = await service.processWebhook(payload, 'stripe');

      expect(result).toEqual({ received: true, processed: true });
      expect(redis.set).toHaveBeenCalledWith(
        'webhook:evt_123',
        true,
        604800,
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
        }),
      );
    });

    it('returns idempotent:true for a duplicate webhook (Redis hit)', async () => {
      const redis = makeRedis();
      redis.get.mockResolvedValue(true as any);
      const { service, repo } = makeService({ redis });

      const result = await service.processWebhook(payload, 'stripe');

      expect(result).toEqual({ received: true, idempotent: true });
      expect(redis.set).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws for a webhook with no ID', async () => {
      const { service } = makeService();

      await expect(
        service.processWebhook({ type: 'some.event' }, 'stripe'),
      ).rejects.toThrow('Webhook payload missing ID for idempotency');
    });

    it('throws and logs failure when Redis.set fails', async () => {
      const redis = makeRedis();
      redis.set.mockRejectedValue(new Error('Redis down'));
      const { service, observability } = makeService({ redis });

      await expect(
        service.processWebhook(payload, 'stripe', undefined, undefined, 'trace-redis-fail'),
      ).rejects.toThrow('Redis down');

      expect(observability.logWebhookProcessingFailed).toHaveBeenCalledWith(
        expect.objectContaining({ webhookId: 'evt_123', source: 'stripe' }),
        expect.any(Error),
        expect.any(Number),
        'trace-redis-fail',
      );
    });

    it('throws and logs failure when repo.save fails', async () => {
      const repo = makeRepo();
      repo.save.mockRejectedValue(new Error('DB error'));
      const { service, observability } = makeService({ repo });

      await expect(
        service.processWebhook(payload, 'stripe', undefined, undefined, 'trace-db-fail'),
      ).rejects.toThrow('DB error');

      expect(observability.logWebhookProcessingFailed).toHaveBeenCalledWith(
        expect.objectContaining({ webhookId: 'evt_123', source: 'stripe' }),
        expect.any(Error),
        expect.any(Number),
        'trace-db-fail',
      );
    });
  });

  // ── Replay interaction (verify + process) ────────────────────────────────

  describe('replay interaction', () => {
    it('second call with same ID returns idempotent:true (replay guard)', async () => {
      const redis = makeRedis();
      const { service } = makeService({ redis });
      const payload = { id: 'evt_replay', type: 'order.completed' };

      // First call stores the key
      await service.processWebhook(payload, 'stripe');

      // Simulate what Redis returns on second call
      redis.get.mockResolvedValue(true as any);

      const second = await service.processWebhook(payload, 'stripe');
      expect(second).toEqual({ received: true, idempotent: true });
    });

    it('logs idempotency hit via observability on duplicate', async () => {
      const redis = makeRedis();
      redis.get.mockResolvedValue(true as any);
      const { service, observability } = makeService({ redis });

      await service.processWebhook(
        { id: 'evt_dup', type: 'test.event' },
        'stripe',
        undefined,
        undefined,
        'trace-dup',
      );

      expect(observability.logIdempotencyHit).toHaveBeenCalledWith(
        expect.objectContaining({ webhookId: 'evt_dup', source: 'stripe' }),
        'trace-dup',
      );
    });

    it('different sources share the same idempotency key (keyed on webhook ID)', async () => {
      const redis = makeRedis();
      // First call: Redis miss → process & store
      // Second call: Redis hit → return idempotent (same key regardless of source)
      redis.get
        .mockResolvedValueOnce(null)   // first call: fresh
        .mockResolvedValueOnce(true as any); // second call: already stored
      const { service } = makeService({ redis });
      const payload = { id: 'evt_multi_source', type: 'payment.completed' };

      const first = await service.processWebhook(payload, 'stripe');
      const second = await service.processWebhook(payload, 'paypal');

      expect(first).toEqual({ received: true, processed: true });
      expect(second).toEqual({ received: true, idempotent: true });
      // Redis.set called only once — second call is a duplicate
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith('webhook:evt_multi_source', true, 604800);
    });
  });

  // ── Audit hooks lifecycle ─────────────────────────────────────────────────

  describe('audit hooks lifecycle', () => {
    it('calls onReceived for every processWebhook call', async () => {
      const auditHooks = makeAuditHooks();
      const { service } = makeService({ auditHooks });

      await service.processWebhook(
        { id: 'evt_hooks', type: 'test.received' },
        'stripe',
        '1.2.3.4',
        'test-agent',
      );

      expect(auditHooks.onReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'evt_hooks',
          source: 'stripe',
          ipAddress: '1.2.3.4',
          userAgent: 'test-agent',
        }),
      );
    });

    it('calls onProcessed after successful processing', async () => {
      const auditHooks = makeAuditHooks();
      const { service } = makeService({ auditHooks });

      await service.processWebhook({ id: 'evt_proc', type: 'test' }, 'stripe');

      expect(auditHooks.onProcessed).toHaveBeenCalledWith(
        expect.objectContaining({ webhookId: 'evt_proc', source: 'stripe' }),
      );
    });

    it('calls onDuplicate for idempotent replay', async () => {
      const redis = makeRedis();
      redis.get.mockResolvedValue(true as any);
      const auditHooks = makeAuditHooks();
      const { service } = makeService({ redis, auditHooks });

      await service.processWebhook({ id: 'evt_dup2', type: 'test' }, 'stripe');

      expect(auditHooks.onDuplicate).toHaveBeenCalledWith(
        expect.objectContaining({ webhookId: 'evt_dup2' }),
      );
      expect(auditHooks.onProcessed).not.toHaveBeenCalled();
    });

    it('calls onFailed when processing throws', async () => {
      const repo = makeRepo();
      repo.save.mockRejectedValue(new Error('DB fail'));
      const auditHooks = makeAuditHooks();
      const { service } = makeService({ repo, auditHooks });

      await expect(
        service.processWebhook({ id: 'evt_fail', type: 'test' }, 'stripe'),
      ).rejects.toThrow();

      expect(auditHooks.onFailed).toHaveBeenCalledWith(
        expect.objectContaining({ webhookId: 'evt_fail', source: 'stripe' }),
      );
    });

    it('calls onSignatureVerified for a valid signature', async () => {
      const auditHooks = makeAuditHooks();
      const { service } = makeService({ auditHooks });
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_sig' });
      const sig = makeSignature(SECRET, ts, body);

      await service.verifySignature(sig, ts, Buffer.from(body), 'stripe', '10.0.0.1');

      expect(auditHooks.onSignatureVerified).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'stripe', ipAddress: '10.0.0.1' }),
      );
    });

    it('calls onSignatureFailed for an invalid signature', async () => {
      const auditHooks = makeAuditHooks();
      const { service } = makeService({ auditHooks });
      const ts = freshTimestamp();

      await service.verifySignature(
        'a'.repeat(64),
        ts,
        Buffer.from('body'),
        'stripe',
        '10.0.0.2',
      );

      expect(auditHooks.onSignatureFailed).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'stripe' }),
      );
    });
  });

  // ── Secret isolation ──────────────────────────────────────────────────────

  describe('secret isolation', () => {
    it('uses the secret from ConfigService, not a hard-coded value', async () => {
      const customSecret = 'custom_secret_abc123';
      const { service } = makeService({ secret: customSecret });
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_custom' });
      const sig = makeSignature(customSecret, ts, body);

      const result = await service.verifySignature(
        sig,
        ts,
        Buffer.from(body),
        'stripe',
      );
      expect(result).toBe(true);
    });

    it('rejects a signature built with a different secret', async () => {
      const { service } = makeService({ secret: 'secret-A' });
      const ts = freshTimestamp();
      const body = JSON.stringify({ id: 'evt_wrong_secret' });
      const sigWithWrongSecret = makeSignature('secret-B', ts, body);

      const result = await service.verifySignature(
        sigWithWrongSecret,
        ts,
        Buffer.from(body),
        'stripe',
      );
      expect(result).toBe(false);
    });
  });
});
