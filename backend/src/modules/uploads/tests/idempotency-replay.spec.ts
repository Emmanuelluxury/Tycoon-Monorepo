import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from '../idempotency/idempotency.service';

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

/** Build a minimal fake Express Request for upload actions. */
function buildReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    path: '/uploads/avatar',
    ip: '127.0.0.1',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as any;
}

describe('Uploads – Idempotency and Replay Tests', () => {
  let service: IdempotencyService;
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
    ttl: jest.Mock;
    ping: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              host: 'localhost',
              port: 6379,
              db: 0,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(IdempotencyService);
    redis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
    };
    (service as any).redis = redis;
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Replay – cache hit
  // ---------------------------------------------------------------------------
  describe('cache hit / replay', () => {
    it('reads a cached idempotency record and replays the body', async () => {
      const req = buildReq({ headers: { 'x-idempotency-key': 'cache-key' } });
      redis.get.mockResolvedValue(
        JSON.stringify({
          key: 'idempotency:cache-key',
          timestamp: Date.now(),
          ttl: 3600,
          response: { statusCode: 201, headers: {}, body: { ok: true } },
        }),
      );

      const result = await service.checkIdempotency(req);
      expect(result?.response?.body).toEqual({ ok: true });
      expect(result?.response?.statusCode).toBe(201);
    });

    it('returns null on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      const req = buildReq({ headers: { 'x-idempotency-key': 'miss-key' } });
      const result = await service.checkIdempotency(req);
      expect(result).toBeNull();
    });

    it('returns null and does not throw when redis errors', async () => {
      redis.get.mockRejectedValue(new Error('Redis ECONNREFUSED'));
      const req = buildReq({ headers: { 'x-idempotency-key': 'error-key' } });
      await expect(service.checkIdempotency(req)).resolves.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Store response
  // ---------------------------------------------------------------------------
  describe('storeResponse', () => {
    it('persists response payload in redis with correct TTL', async () => {
      redis.setex.mockResolvedValue('OK');
      const req = buildReq({ headers: { 'x-idempotency-key': 'store-key' } });

      await service.storeResponse(
        req,
        {
          statusCode: 201,
          getHeaders: () => ({ 'content-type': 'application/json' }),
          body: { uploaded: true },
        },
        { ttl: 60 },
      );

      expect(redis.setex).toHaveBeenCalledTimes(1);
      const [key, ttl, payload] = redis.setex.mock.calls[0];
      expect(key).toContain('store-key');
      expect(ttl).toBe(60);
      const parsed = JSON.parse(payload);
      expect(parsed.response.body).toEqual({ uploaded: true });
      expect(parsed.response.statusCode).toBe(201);
    });

    it('drops the response body when it exceeds maxResponseSize', async () => {
      redis.setex.mockResolvedValue('OK');
      const req = buildReq({ headers: { 'x-idempotency-key': 'large-body' } });
      const hugeBody = { data: 'x'.repeat(2048) };

      await service.storeResponse(
        req,
        { statusCode: 200, getHeaders: () => ({}), body: hugeBody },
        { maxResponseSize: 10 }, // very small limit
      );

      const [, , payload] = redis.setex.mock.calls[0];
      const parsed = JSON.parse(payload);
      // body should be absent / undefined because it exceeded the size cap
      expect(parsed.response.body).toBeUndefined();
    });

    it('does not throw when redis setex fails', async () => {
      redis.setex.mockRejectedValue(new Error('Redis unavailable'));
      const req = buildReq({ headers: { 'x-idempotency-key': 'fail-store' } });

      await expect(
        service.storeResponse(req, {
          statusCode: 200,
          getHeaders: () => ({}),
          body: { ok: true },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Key generation
  // ---------------------------------------------------------------------------
  describe('generateKey', () => {
    it('uses the client-supplied X-Idempotency-Key header', () => {
      const req = buildReq({ headers: { 'x-idempotency-key': 'my-upload-key' } });
      const key = service.generateKey(req);
      expect(key).toBe('idempotency:my-upload-key');
    });

    it('generates a deterministic server-side key for the same request', () => {
      const req = buildReq({ body: { filename: 'avatar.jpg' } });
      const k1 = service.generateKey(req, { includeBody: true });
      const k2 = service.generateKey(req, { includeBody: true });
      expect(k1).toBe(k2);
    });

    it('generates different keys for different paths', () => {
      const r1 = buildReq({ path: '/uploads/avatar' });
      const r2 = buildReq({ path: '/uploads/admin/assets' });
      expect(service.generateKey(r1)).not.toBe(service.generateKey(r2));
    });

    it('generates different keys for different IPs', () => {
      const r1 = buildReq({ ip: '1.2.3.4' });
      const r2 = buildReq({ ip: '5.6.7.8' });
      expect(service.generateKey(r1)).not.toBe(service.generateKey(r2));
    });
  });

  // ---------------------------------------------------------------------------
  // Request integrity
  // ---------------------------------------------------------------------------
  describe('validateRequestIntegrity', () => {
    it('passes when no requestHash is stored (legacy/missing)', () => {
      const req = buildReq();
      const valid = service.validateRequestIntegrity(req, {} as any);
      expect(valid).toBe(true);
    });

    it('passes when current hash matches stored hash', () => {
      const req = buildReq({ body: { amount: 1 } });
      const hash = (service as any).createRequestHash(req, { includeBody: true });
      const valid = service.validateRequestIntegrity(
        req,
        { requestHash: hash } as any,
        { includeBody: true },
      );
      expect(valid).toBe(true);
    });

    it('fails when body changes between requests for same key', () => {
      const original = buildReq({ body: { amount: 1 } });
      const tampered = buildReq({ body: { amount: 999 } });
      const hash = (service as any).createRequestHash(original, { includeBody: true });
      const valid = service.validateRequestIntegrity(
        tampered,
        { requestHash: hash } as any,
        { includeBody: true },
      );
      expect(valid).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // clearRecord
  // ---------------------------------------------------------------------------
  describe('clearRecord', () => {
    it('calls redis DEL with the supplied key', async () => {
      redis.del.mockResolvedValue(1);
      await service.clearRecord('idempotency:some-key');
      expect(redis.del).toHaveBeenCalledWith('idempotency:some-key');
    });

    it('does not throw when redis DEL fails', async () => {
      redis.del.mockRejectedValue(new Error('Redis error'));
      await expect(service.clearRecord('bad-key')).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------
  describe('healthCheck', () => {
    it('returns healthy when redis ping succeeds', async () => {
      redis.ping.mockResolvedValue('PONG');
      const health = await service.healthCheck();
      expect(health).toEqual({ status: 'healthy', redis: true });
    });

    it('returns unhealthy when redis ping throws', async () => {
      redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));
      const health = await service.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.redis).toBe(false);
      expect(health.error).toBeDefined();
    });
  });
});
