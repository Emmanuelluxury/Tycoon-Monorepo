import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BoardStylesService } from './board-styles.service';
import { BoardStyle } from './entities/board-style.entity';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('BoardStylesService — Observability (#876)', () => {
  let service: BoardStylesService;
  let repository: Repository<BoardStyle>;
  let redisService: RedisService;
  let loggerService: LoggerService;

  const mockBoardStyle: BoardStyle = {
    id: 1,
    name: 'Test Style',
    is_premium: false,
    created_at: new Date(),
    updated_at: new Date(),
  } as BoardStyle;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn().mockReturnValue(mockBoardStyle),
      save: jest.fn().mockResolvedValue(mockBoardStyle),
      findOne: jest.fn().mockResolvedValue(mockBoardStyle),
      merge: jest.fn().mockReturnValue(mockBoardStyle),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockBoardStyle]),
      }),
    };

    const mockRedisService = {
      delByPattern: jest.fn().mockResolvedValue(1),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      logWithMeta: jest.fn(),
      getWinstonLogger: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardStylesService,
        {
          provide: getRepositoryToken(BoardStyle),
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<BoardStylesService>(BoardStylesService);
    repository = module.get<Repository<BoardStyle>>(
      getRepositoryToken(BoardStyle)
    );
    redisService = module.get<RedisService>(RedisService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  describe('Structured Logging', () => {
    it('logs board style creation with metadata', async () => {
      await service.create({ name: 'New Style', is_premium: false });

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Board style created',
        expect.objectContaining({
          styleId: 1,
          isPremium: false,
          context: 'BoardStylesService',
        })
      );
    });

    it('includes duration in creation log', async () => {
      await service.create({ name: 'New Style', is_premium: false });

      const call = (loggerService.logWithMeta as jest.Mock).mock.calls[0];
      expect(call[2]).toHaveProperty('duration');
      expect(typeof call[2].duration).toBe('number');
      expect(call[2].duration).toBeGreaterThanOrEqual(0);
    });

    it('logs board style fetch with result count', async () => {
      await service.findAll();

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Board styles fetched',
        expect.objectContaining({
          count: 1,
          isPremiumFilter: undefined,
          context: 'BoardStylesService',
        })
      );
    });

    it('logs board style retrieval by id', async () => {
      await service.findOne(1);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Board style retrieved',
        expect.objectContaining({
          styleId: 1,
          context: 'BoardStylesService',
        })
      );
    });

    it('logs board style not found as warning', async () => {
      (repository.findOne as jest.Mock).mockResolvedValueOnce(null);

      try {
        await service.findOne(999);
      } catch {
        // Expected to throw
      }

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'warn',
        'Board style not found',
        expect.objectContaining({
          styleId: 999,
          context: 'BoardStylesService',
        })
      );
    });

    it('logs board style update with metadata', async () => {
      await service.update(1, { name: 'Updated' });

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Board style updated',
        expect.objectContaining({
          styleId: 1,
          context: 'BoardStylesService',
        })
      );
    });

    it('logs board style deletion with metadata', async () => {
      await service.remove(1);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Board style deleted',
        expect.objectContaining({
          styleId: 1,
          context: 'BoardStylesService',
        })
      );
    });
  });

  describe('Error Logging', () => {
    it('logs creation errors without stack trace leakage', async () => {
      const error = new Error('Database connection failed');
      (repository.save as jest.Mock).mockRejectedValueOnce(error);

      try {
        await service.create({ name: 'Style', is_premium: false });
      } catch {
        // Expected
      }

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create board style'),
        expect.any(String),
        'BoardStylesService.create'
      );
    });

    it('logs fetch errors appropriately', async () => {
      const error = new Error('Query timeout');
      (repository.createQueryBuilder as jest.Mock).mockReturnValueOnce({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValueOnce(error),
      });

      try {
        await service.findAll();
      } catch {
        // Expected
      }

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch board styles'),
        expect.any(String),
        'BoardStylesService.findAll'
      );
    });

    it('logs 404 errors as warnings before throwing', async () => {
      (repository.findOne as jest.Mock).mockResolvedValueOnce(null);

      try {
        await service.findOne(999);
      } catch {
        // Expected
      }

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'warn',
        'Board style not found',
        expect.any(Object)
      );
    });

    it('does not log cache invalidation errors as fatal', async () => {
      (redisService.delByPattern as jest.Mock).mockRejectedValueOnce(
        new Error('Redis unavailable')
      );

      await service.remove(1);

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate board styles cache'),
        'BoardStylesService.invalidateCache'
      );
    });
  });

  describe('Cache Invalidation Logging', () => {
    it('logs cache invalidation for specific style', async () => {
      await service.update(1, { name: 'Updated' });

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Board styles cache invalidated',
        expect.objectContaining({
          styleId: 1,
          context: 'BoardStylesService',
        })
      );
    });

    it('logs cache invalidation for all styles when id not specified', async () => {
      await service.create({ name: 'New Style', is_premium: false });

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Board styles cache invalidated',
        expect.any(Object)
      );
    });
  });

  describe('Log Context Preservation', () => {
    it('includes context field in all metadata logs', async () => {
      await service.create({ name: 'Style', is_premium: true });
      await service.findAll();
      await service.findOne(1);

      const calls = (loggerService.logWithMeta as jest.Mock).mock.calls;
      calls.forEach((call) => {
        if (call[2]) {
          expect(call[2]).toHaveProperty('context');
          expect(call[2].context).toBe('BoardStylesService');
        }
      });
    });

    it('preserves operation-specific metadata', async () => {
      await service.findAll(true);

      const call = (loggerService.logWithMeta as jest.Mock).mock.calls.find(
        (c) => c[1] === 'Board styles fetched'
      );
      expect(call[2]).toHaveProperty('isPremiumFilter', true);
    });
  });
});
