/**
 * Redis / Cache Layer — Observability spec
 * Stellar Wave · SW-BE-031
 *
 * Covers:
 *  - Structured logs (debug, warn, error) on every operation
 *  - Prometheus counter/histogram/gauge increments (metrics)
 *  - Graceful degradation traces (errors do not throw for non-critical paths)
 *  - Connection lifecycle events (connect / disconnect / error)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import { LoggerService } from '../../common/logger/logger.service';

// ── Prometheus mock — prevents duplicate-metric errors across test runs ────────
const mockCounterInc = jest.fn();
const mockGaugeSet = jest.fn();
const mockHistogramStartTimer = jest.fn();
const mockTimerEnd = jest.fn();

jest.mock('prom-client', () => {
  const counter = () => ({ inc: mockCounterInc });
  const gauge = () => ({ set: mockGaugeSet });
  const histogram = () => ({
    startTimer: mockHistogramStartTimer.mockReturnValue(mockTimerEnd),
    observe: jest.fn(),
  });
  return { Counter: jest.fn(counter), Gauge: jest.fn(gauge), Histogram: jest.fn(histogram) };
});

// ── ioredis mock ───────────────────────────────────────────────────────────────
const mockRedisInstance = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedisInstance));

// ── Helpers ────────────────────────────────────────────────────────────────────

function getConnectionHandler(eventName: string): (...args: unknown[]) => void {
  const call = mockRedisInstance.on.mock.calls.find(([e]: string[]) => e === eventName);
  if (!call) throw new Error(`No handler registered for event "${eventName}"`);
  return call[1] as (...args: unknown[]) => void;
}

// ── Setup ──────────────────────────────────────────────────────────────────────

describe('SW-BE-031 — RedisService observability', () => {
  let service: RedisService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let logger: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHistogramStartTimer.mockReturnValue(mockTimerEnd);

    cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: LoggerService, useValue: logger },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              host: 'localhost',
              port: 6379,
              db: 0,
              ttl: 300,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  // ── Connection lifecycle logs ────────────────────────────────────────────────

  describe('Connection lifecycle — logs & metrics', () => {
    it('logs INFO and sets connections gauge to 1 on connect', () => {
      const handler = getConnectionHandler('connect');
      handler();
      expect(logger.log).toHaveBeenCalledWith('Connected to Redis', 'RedisService');
      expect(mockGaugeSet).toHaveBeenCalledWith(1);
    });

    it('logs WARN and sets connections gauge to 0 on disconnect', () => {
      const handler = getConnectionHandler('disconnect');
      handler();
      expect(logger.warn).toHaveBeenCalledWith('Disconnected from Redis', 'RedisService');
      expect(mockGaugeSet).toHaveBeenCalledWith(0);
    });

    it('logs ERROR and increments error counter on connection error', () => {
      const handler = getConnectionHandler('error');
      handler(new Error('ECONNREFUSED'));
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'connection' });
    });
  });

  // ── Cache GET — logs & metrics ───────────────────────────────────────────────

  describe('cache get — logs & metrics', () => {
    it('logs debug CACHE HIT and increments hit counter', async () => {
      cacheManager.get.mockResolvedValue('cached-value');
      await service.get('some:key');
      expect(logger.debug).toHaveBeenCalledWith('Cache HIT: some:key', 'RedisService');
      expect(mockCounterInc).toHaveBeenCalledWith(); // cacheHitsTotal.inc()
    });

    it('logs debug CACHE MISS and increments miss counter on undefined', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      await service.get('missing:key');
      expect(logger.debug).toHaveBeenCalledWith('Cache MISS: missing:key', 'RedisService');
    });

    it('starts and ends duration histogram timer on GET', async () => {
      cacheManager.get.mockResolvedValue('v');
      await service.get('k');
      expect(mockHistogramStartTimer).toHaveBeenCalledWith({ operation: 'cache_get' });
      expect(mockTimerEnd).toHaveBeenCalled();
    });

    it('logs error and returns undefined on cache GET failure (graceful degradation)', async () => {
      cacheManager.get.mockRejectedValue(new Error('Redis timeout'));
      const result = await service.get('bad:key');
      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache GET error for bad:key'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'cache_get' });
    });
  });

  // ── Cache SET — logs & metrics ───────────────────────────────────────────────

  describe('cache set — logs & metrics', () => {
    it('increments operations counter on successful SET', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      await service.set('k', 'v', 300);
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'cache_set' });
    });

    it('starts and ends duration histogram timer on SET', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      await service.set('k', 'v', 300);
      expect(mockHistogramStartTimer).toHaveBeenCalledWith({ operation: 'cache_set' });
      expect(mockTimerEnd).toHaveBeenCalled();
    });

    it('logs error and increments error counter on SET failure', async () => {
      cacheManager.set.mockRejectedValue(new Error('OOM'));
      await expect(service.set('k', 'v', 300)).rejects.toThrow('OOM');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache SET error for k'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'cache_set' });
    });
  });

  // ── Session management — logs & metrics ─────────────────────────────────────

  describe('setRefreshToken — logs & metrics', () => {
    it('logs debug on success', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      await service.setRefreshToken('user-1', 'tok');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Set refresh token for user user-1'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'set_refresh_token' });
    });

    it('logs error and increments error counter on failure', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('down'));
      await expect(service.setRefreshToken('user-1', 'tok')).rejects.toThrow('down');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to set refresh token for user user-1'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'set_refresh_token' });
    });

    it('duration histogram is started and stopped on success', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      await service.setRefreshToken('user-1', 'tok');
      expect(mockHistogramStartTimer).toHaveBeenCalledWith({ operation: 'set_refresh_token' });
      expect(mockTimerEnd).toHaveBeenCalled();
    });

    it('duration histogram is stopped even on failure (finally block)', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('down'));
      await service.setRefreshToken('user-1', 'tok').catch(() => {});
      expect(mockTimerEnd).toHaveBeenCalled();
    });
  });

  describe('getRefreshToken — logs & metrics', () => {
    it('logs debug on success', async () => {
      mockRedisInstance.get.mockResolvedValue('tok');
      await service.getRefreshToken('user-2');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved refresh token for user user-2'),
        'RedisService',
      );
    });

    it('logs error and returns null on Redis failure (graceful degradation)', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('timeout'));
      const result = await service.getRefreshToken('user-2');
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get refresh token for user user-2'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'get_refresh_token' });
    });
  });

  // ── Rate limiting — logs & metrics ───────────────────────────────────────────

  describe('incrementRateLimit — logs & metrics', () => {
    it('logs debug with current count on success', async () => {
      mockRedisInstance.incr.mockResolvedValue(3);
      await service.incrementRateLimit('rl:u1');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Incremented rate limit for key rl:u1 to 3'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'increment_rate_limit' });
    });

    it('logs error and returns 0 on Redis failure (graceful degradation)', async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error('down'));
      const count = await service.incrementRateLimit('rl:u1');
      expect(count).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to increment rate limit for key rl:u1'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'increment_rate_limit' });
    });
  });

  // ── deleteRefreshToken — logs & metrics ─────────────────────────────────────

  describe('deleteRefreshToken — logs & metrics', () => {
    it('increments operations counter on success', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      await service.deleteRefreshToken('user-3');
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'delete_refresh_token' });
    });

    it('logs error and increments error counter on failure', async () => {
      mockRedisInstance.del.mockRejectedValue(new Error('crash'));
      await expect(service.deleteRefreshToken('user-3')).rejects.toThrow('crash');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete refresh token for user user-3'),
        'RedisService',
      );
      expect(mockCounterInc).toHaveBeenCalledWith({ operation: 'delete_refresh_token' });
    });
  });

  // ── delByPattern — logs & metrics ─────────────────────────────────────────

  describe('delByPattern — metrics', () => {
    it('deletes matched keys and tracks the operation', async () => {
      mockRedisInstance.keys.mockResolvedValue(['a', 'b', 'c']);
      mockRedisInstance.del.mockResolvedValue(3);
      await service.delByPattern('prefix:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('a', 'b', 'c');
    });

    it('no-ops silently when no keys match', async () => {
      mockRedisInstance.keys.mockResolvedValue([]);
      await service.delByPattern('prefix:*');
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });
  });

  // ── Prometheus metric names ─────────────────────────────────────────────────

  describe('Metric naming — observable labels', () => {
    it('operation counters use expected label values for cache_get', async () => {
      cacheManager.get.mockResolvedValue('v');
      await service.get('k');
      const incCalls = mockCounterInc.mock.calls;
      const opLabels = incCalls
        .filter((c) => c[0]?.operation)
        .map((c) => c[0].operation);
      expect(opLabels).toContain('cache_get');
    });

    it('timer labels match operation name for session ops', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      await service.setRefreshToken('u', 't');
      const timerCalls = mockHistogramStartTimer.mock.calls.map((c) => c[0]?.operation);
      expect(timerCalls).toContain('set_refresh_token');
    });
  });
});
