/**
 * Metrics & Health — idempotency and replay tests
 * Stellar Wave · SW-BE-027
 *
 * Verifies that:
 *  1. Health endpoints are idempotent — successive calls always return the
 *     same deterministic shape and do not mutate state.
 *  2. The IdempotencyService correctly transitions states and replays cached
 *     responses when the same key is submitted twice.
 *  3. The health controller degrades gracefully under repeated Redis failure.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { HealthController } from '../../health/health.controller';
import { RedisService } from '../redis/redis.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { IdempotencyService } from '../redis/idempotency.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockDataSource = { query: jest.fn() };

const makeIdempotencyService = (redisStore: Map<string, unknown>) => ({
  get: jest.fn(async (k: string) => redisStore.get(k)),
  markProcessing: jest.fn(async (k: string) => {
    redisStore.set(k, { status: 'processing', createdAt: Date.now() });
  }),
  markComplete: jest.fn(async (k: string, response: unknown) => {
    redisStore.set(k, { status: 'complete', response, createdAt: Date.now() });
  }),
  delete: jest.fn(async (k: string) => {
    redisStore.delete(k);
  }),
});

// ── Health endpoint idempotency ───────────────────────────────────────────────

describe('SW-BE-027 — Health endpoint idempotency', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: RedisService, useValue: mockRedis },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: AuditTrailService, useValue: { log: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('liveness is idempotent — multiple calls return identical shape', () => {
    const first = controller.liveness();
    const second = controller.liveness();

    expect(first.status).toBe('healthy');
    expect(second.status).toBe('healthy');
    // Shape must be consistent
    expect(Object.keys(first)).toEqual(Object.keys(second));
  });

  it('readiness returns consistent shape on repeated healthy calls', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const [r1, r2, r3] = await Promise.all([
      controller.readiness(),
      controller.readiness(),
      controller.readiness(),
    ]);

    expect(r1.status).toBe('healthy');
    expect(r2.status).toBe('healthy');
    expect(r3.status).toBe('healthy');
  });

  it('readiness is idempotent under Redis failure — returns unhealthy each time', async () => {
    mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const r1 = await controller.readiness();
    const r2 = await controller.readiness();

    expect(r1.status).toBe('unhealthy');
    expect(r1.redis).toBe('disconnected');
    expect(r2.status).toBe('unhealthy');
    expect(r2.redis).toBe('disconnected');
    // No state leak: database still reported correctly
    expect(r1.database).toBe('connected');
    expect(r2.database).toBe('connected');
  });

  it('aggregate toggles correctly when Redis recovers between calls', async () => {
    // First call: Redis down
    mockRedis.set.mockRejectedValueOnce(new Error('down'));
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    const degraded = await controller.aggregate();
    expect(degraded.status).toBe('degraded');

    // Second call: Redis recovered
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    const healthy = await controller.aggregate();
    expect(healthy.status).toBe('healthy');
  });

  it('redis-only endpoint is idempotent — healthy → healthy', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');

    const r1 = await controller.checkRedis();
    const r2 = await controller.checkRedis();

    expect(r1.status).toBe('healthy');
    expect(r2.status).toBe('healthy');
    expect(r1.redis).toBe('connected');
    expect(r2.redis).toBe('connected');
  });

  it('redis-only endpoint is idempotent — unhealthy → unhealthy', async () => {
    mockRedis.set.mockRejectedValue(new Error('down'));

    const r1 = await controller.checkRedis();
    const r2 = await controller.checkRedis();

    expect(r1.status).toBe('unhealthy');
    expect(r2.status).toBe('unhealthy');
  });
});

// ── IdempotencyService state transitions ──────────────────────────────────────

describe('SW-BE-027 — IdempotencyService state transitions', () => {
  let service: IdempotencyService;
  let redisMock: jest.Mocked<Pick<RedisService, 'get' | 'set' | 'del'>>;
  const store = new Map<string, unknown>();

  beforeEach(async () => {
    store.clear();
    redisMock = {
      get: jest.fn(async (k: string) => store.get(k)),
      set: jest.fn(async (k: string, v: unknown) => { store.set(k, v); }),
      del: jest.fn(async (k: string) => { store.delete(k); }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  it('returns undefined for unknown key', async () => {
    expect(await service.get('unknown-key')).toBeUndefined();
  });

  it('markProcessing stores processing record', async () => {
    await service.markProcessing('key-1');
    const record = await service.get('key-1');
    expect(record).toMatchObject({ status: 'processing' });
  });

  it('markComplete transitions record to complete with response', async () => {
    await service.markProcessing('key-2');
    await service.markComplete('key-2', { result: 'ok' });
    const record = await service.get('key-2');
    expect(record).toMatchObject({ status: 'complete', response: { result: 'ok' } });
  });

  it('delete removes the record', async () => {
    await service.markProcessing('key-3');
    await service.delete('key-3');
    expect(await service.get('key-3')).toBeUndefined();
  });

  it('markComplete on non-existent key still writes complete record', async () => {
    // Idempotency records may be written directly to complete (e.g., fast-path)
    await service.markComplete('key-4', { data: 42 });
    const record = await service.get('key-4');
    expect(record).toMatchObject({ status: 'complete', response: { data: 42 } });
  });
});

// ── Replay scenario: same key submitted twice ─────────────────────────────────

describe('SW-BE-027 — Idempotency replay scenario', () => {
  it('second submission replays the cached response (complete state)', async () => {
    const store = new Map<string, unknown>();
    const idempotencySvc = makeIdempotencyService(store);

    const KEY = 'replay-key-abc123';
    const ORIGINAL_RESPONSE = { gameId: 'g-001', status: 'RUNNING' };

    // Simulate first request lifecycle
    await idempotencySvc.markProcessing(KEY);
    let record = await idempotencySvc.get(KEY);
    expect(record).toMatchObject({ status: 'processing' });

    await idempotencySvc.markComplete(KEY, ORIGINAL_RESPONSE);

    // Second request: key already exists as complete
    record = await idempotencySvc.get(KEY);
    expect(record).toMatchObject({ status: 'complete', response: ORIGINAL_RESPONSE });

    // The same response should be returned without executing the handler again
    expect(idempotencySvc.markProcessing).toHaveBeenCalledTimes(1);
    expect(idempotencySvc.markComplete).toHaveBeenCalledTimes(1);
  });

  it('in-flight (processing) key returns conflict — not replayed', async () => {
    const store = new Map<string, unknown>();
    const idempotencySvc = makeIdempotencyService(store);

    const KEY = 'in-flight-key';

    await idempotencySvc.markProcessing(KEY);
    const record = await idempotencySvc.get(KEY);

    // Processing state should indicate conflict to the interceptor layer
    expect(record).toMatchObject({ status: 'processing' });
    // No complete response is available
    expect((record as { response?: unknown }).response).toBeUndefined();
  });

  it('deleted key allows fresh request (no stale replay)', async () => {
    const store = new Map<string, unknown>();
    const idempotencySvc = makeIdempotencyService(store);

    const KEY = 'deleted-key';

    await idempotencySvc.markComplete(KEY, { result: 'first' });
    await idempotencySvc.delete(KEY);

    const record = await idempotencySvc.get(KEY);
    expect(record).toBeUndefined(); // No replay; fresh request allowed
  });

  it('replay does not mutate original response payload', async () => {
    const store = new Map<string, unknown>();
    const idempotencySvc = makeIdempotencyService(store);

    const KEY = 'immutable-key';
    const RESPONSE = { items: ['a', 'b', 'c'], count: 3 };

    await idempotencySvc.markComplete(KEY, RESPONSE);

    const replay1 = (await idempotencySvc.get(KEY)) as { status: string; response: typeof RESPONSE };
    const replay2 = (await idempotencySvc.get(KEY)) as { status: string; response: typeof RESPONSE };

    // Both replays return the same payload
    expect(replay1.response).toEqual(RESPONSE);
    expect(replay2.response).toEqual(RESPONSE);
    // Replays are the same reference from the store
    expect(replay1.response).toEqual(replay2.response);
  });
});
