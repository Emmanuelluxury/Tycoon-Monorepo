/**
 * SW-BE-028 — HealthController: DTO validation and error mapping tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HealthController } from './health.controller';
import { RedisService } from '../modules/redis/redis.service';
import { AuditTrailService } from '../modules/audit-trail/audit-trail.service';

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
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
    jest.clearAllMocks();
  });

  // ── liveness ──────────────────────────────────────────────────────────────

  describe('liveness()', () => {
    it('always returns status healthy', () => {
      expect(controller.liveness().status).toBe('healthy');
    });

    it('includes a timestamp string', () => {
      expect(typeof controller.liveness().timestamp).toBe('string');
    });

    it('includes uptime as a number', () => {
      expect(typeof controller.liveness().uptime).toBe('number');
    });
  });

  // ── readiness ─────────────────────────────────────────────────────────────

  describe('readiness()', () => {
    it('returns 200 healthy when both redis and db are up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.readiness();
      expect(result.status).toBe('healthy');
      expect(result.redis).toBe('connected');
      expect(result.database).toBe('connected');
    });

    it('throws 503 when redis is down', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      await expect(controller.readiness()).rejects.toThrow(HttpException);
      await expect(controller.readiness()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('throws 503 when database is down', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockRejectedValue(new Error('db down'));

      await expect(controller.readiness()).rejects.toThrow(HttpException);
    });

    it('throws 503 when both dependencies are down', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      mockDataSource.query.mockRejectedValue(new Error('db down'));

      await expect(controller.readiness()).rejects.toThrow(HttpException);
    });

    it('503 body includes disconnected dependency detail', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      let thrown: HttpException | undefined;
      try {
        await controller.readiness();
      } catch (e) {
        thrown = e as HttpException;
      }

      expect(thrown).toBeInstanceOf(HttpException);
      const body = thrown!.getResponse() as Record<string, unknown>;
      expect(body.status).toBe('unhealthy');
      expect(body.redis).toBe('disconnected');
      expect(body.database).toBe('connected');
    });
  });

  // ── aggregate ─────────────────────────────────────────────────────────────

  describe('aggregate()', () => {
    it('returns 200 healthy when all deps are up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.aggregate();
      expect(result.status).toBe('healthy');
    });

    it('returns 200 degraded when one dependency is down', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.aggregate();
      expect(result.status).toBe('degraded');
    });

    it('throws 503 when all dependencies are down', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      mockDataSource.query.mockRejectedValue(new Error('db down'));

      await expect(controller.aggregate()).rejects.toThrow(HttpException);
      await expect(controller.aggregate()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('includes memory in the response body', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      expect(result.memory).toBeDefined();
      expect(typeof result.memory!.heapUsedMb).toBe('number');
      expect(typeof result.memory!.rssMb).toBe('number');
    });
  });

  // ── checkRedis ────────────────────────────────────────────────────────────

  describe('checkRedis()', () => {
    it('returns 200 healthy when redis is up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');

      const result = await controller.checkRedis();
      expect(result.status).toBe('healthy');
      expect(result.redis).toBe('connected');
    });

    it('throws 503 when redis is down', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(controller.checkRedis()).rejects.toThrow(HttpException);
      await expect(controller.checkRedis()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });

    it('503 body includes disconnected redis status', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      let thrown: HttpException | undefined;
      try {
        await controller.checkRedis();
      } catch (e) {
        thrown = e as HttpException;
      }

      const body = thrown!.getResponse() as Record<string, unknown>;
      expect(body.status).toBe('unhealthy');
      expect(body.redis).toBe('disconnected');
    });
  });
});
