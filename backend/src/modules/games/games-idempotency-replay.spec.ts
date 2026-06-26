/**
 * SW-GM-IDMP — Games & Matchmaking: Idempotency and Replay Tests
 *
 * Verifies that every state-mutating game action (create, join, roll-dice,
 * pay-rent, pay-tax, buy-property) behaves correctly when the same
 * X-Idempotency-Key is sent more than once:
 *   • First call  → handler invoked, response cached for 24 h
 *   • Replay call → cached response returned, handler NOT invoked again
 *   • Missing key on @Idempotent() endpoint → 400
 *   • Concurrent lock (same key in-flight) → 400
 *   • Keys are scoped per user — user A's key ≠ user B's key
 */

import {
  BadRequestException,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { RedisService } from '../redis/redis.service';

// ── shared mock ───────────────────────────────────────────────────────────────

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incrementRateLimit: jest.fn(),
};

// ── context builder ───────────────────────────────────────────────────────────

function buildCtx(opts: {
  key?: string;
  userId?: number | null;
  statusCode?: number;
  omitKey?: boolean;
}): ExecutionContext {
  const { key = 'test-key', userId = 1, statusCode = HttpStatus.CREATED, omitKey = false } = opts;
  const response = { statusCode, status: jest.fn().mockReturnThis() };
  return {
    getHandler: jest.fn().mockReturnValue('handler'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        headers: omitKey ? {} : { 'x-idempotency-key': key },
        user: userId !== null ? { id: userId } : undefined,
      }),
      getResponse: jest.fn().mockReturnValue(response),
    }),
  } as unknown as ExecutionContext;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function collectEmitted<T>(obs$: any): Promise<T> {
  return new Promise<T>((resolve) => obs$.subscribe((v: T) => resolve(v)));
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('Games Idempotency & Replay (SW-GM-IDMP)', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        { provide: RedisService, useValue: mockRedisService },
        Reflector,
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  const asIdempotent = () => jest.spyOn(reflector, 'get').mockReturnValue(true);
  const asNonIdempotent = () => jest.spyOn(reflector, 'get').mockReturnValue(false);

  const firstCallSetup = () => {
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.incrementRateLimit.mockResolvedValue(1);
    mockRedisService.set.mockResolvedValue(undefined);
    mockRedisService.del.mockResolvedValue(undefined);
  };

  // ── POST /games — create game ─────────────────────────────────────────────

  describe('POST /games — create game', () => {
    const createdGame = { id: 1, code: 'ABC123', status: 'PENDING', creator_id: 7 };

    it('first call: invokes handler and caches result for 24 hours', async () => {
      asIdempotent();
      firstCallSetup();
      const ctx = buildCtx({ key: 'create-1', userId: 7 });
      const next = { handle: jest.fn().mockReturnValue(of(createdGame)) };

      const obs$ = await interceptor.intercept(ctx, next as any);
      await new Promise((res) => obs$.subscribe({ complete: res as any }));

      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'idempotency:7:create-1',
        { statusCode: HttpStatus.CREATED, body: createdGame },
        86400,
      );
    });

    it('replay: returns cached game without calling handler again', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.CREATED,
        body: createdGame,
      });
      const ctx = buildCtx({ key: 'create-1', userId: 7 });
      const next = { handle: jest.fn() };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(createdGame);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('missing key: throws 400 when X-Idempotency-Key header is absent', async () => {
      asIdempotent();
      const ctx = buildCtx({ userId: 7, omitKey: true });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        'X-Idempotency-Key header is required',
      );
    });

    it('concurrent: rejects second in-flight request with same key', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(2); // lock already held
      const ctx = buildCtx({ key: 'create-concurrent', userId: 7 });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        'A request with this idempotency key is already in progress',
      );
    });

    it('user-scoped: same key used by different users produces separate cache entries', async () => {
      asIdempotent();
      firstCallSetup();
      const sharedKey = 'shared-create-key';

      const ctxA = buildCtx({ key: sharedKey, userId: 10 });
      const ctxB = buildCtx({ key: sharedKey, userId: 20 });
      const nextA = { handle: jest.fn().mockReturnValue(of({ id: 1 })) };
      const nextB = { handle: jest.fn().mockReturnValue(of({ id: 2 })) };

      await interceptor.intercept(ctxA, nextA as any);
      await interceptor.intercept(ctxB, nextB as any);

      expect(mockRedisService.get).toHaveBeenCalledWith(`idempotency:10:${sharedKey}`);
      expect(mockRedisService.get).toHaveBeenCalledWith(`idempotency:20:${sharedKey}`);
    });

    it('lock is released after a successful create', async () => {
      asIdempotent();
      firstCallSetup();
      const ctx = buildCtx({ key: 'create-lock-release', userId: 7 });
      const next = { handle: jest.fn().mockReturnValue(of(createdGame)) };

      const obs$ = await interceptor.intercept(ctx, next as any);
      await new Promise((res) => obs$.subscribe({ complete: res as any }));

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'idempotency:7:create-lock-release:lock',
      );
    });
  });

  // ── POST /games/:id/join — join game ──────────────────────────────────────

  describe('POST /games/:id/join — join game', () => {
    const joinedPlayer = { id: 5, game_id: 10, user_id: 3, balance: 1500, turn_order: 2 };

    it('replay: returns cached player record without joining again', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.CREATED,
        body: joinedPlayer,
      });
      const ctx = buildCtx({ key: 'join-game-10', userId: 3 });
      const next = { handle: jest.fn() };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(joinedPlayer);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('first call: caches join result scoped to user', async () => {
      asIdempotent();
      firstCallSetup();
      const ctx = buildCtx({ key: 'join-game-10', userId: 3 });
      const next = { handle: jest.fn().mockReturnValue(of(joinedPlayer)) };

      const obs$ = await interceptor.intercept(ctx, next as any);
      await new Promise((res) => obs$.subscribe({ complete: res as any }));

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'idempotency:3:join-game-10',
        expect.objectContaining({ body: joinedPlayer }),
        86400,
      );
    });

    it('concurrent join: rejects duplicate in-flight join request', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(2);
      const ctx = buildCtx({ key: 'join-concurrent', userId: 3 });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        'A request with this idempotency key is already in progress',
      );
    });
  });

  // ── POST /games/:gameId/players/:playerId/roll-dice ───────────────────────

  describe('POST roll-dice — roll dice idempotency', () => {
    const rollResult = { id: 5, position: 8, rolls: 1, rolled: 1, balance: 1700 };

    it('replay: returns cached roll without re-rolling', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.OK,
        body: rollResult,
      });
      const ctx = buildCtx({ key: 'roll-turn-1', userId: 3, statusCode: HttpStatus.OK });
      const next = { handle: jest.fn() };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(rollResult);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('first roll: handler is called and result is cached', async () => {
      asIdempotent();
      firstCallSetup();
      const ctx = buildCtx({ key: 'roll-turn-2', userId: 3, statusCode: HttpStatus.OK });
      const next = { handle: jest.fn().mockReturnValue(of(rollResult)) };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(rollResult);
      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('missing key on roll-dice endpoint throws 400', async () => {
      asIdempotent();
      const ctx = buildCtx({ userId: 3, omitKey: true });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── POST /games/:gameId/players/:playerId/pay-rent ────────────────────────

  describe('POST pay-rent — pay rent idempotency', () => {
    const rentResult = { payer: { id: 1, balance: 1300 }, payee: { id: 2, balance: 1700 }, finalRent: 200 };

    it('replay: returns cached rent transaction without re-charging', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.OK,
        body: rentResult,
      });
      const ctx = buildCtx({ key: 'rent-boardwalk', userId: 1 });
      const next = { handle: jest.fn() };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(rentResult);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('first pay-rent: processes and caches with user scope', async () => {
      asIdempotent();
      firstCallSetup();
      const ctx = buildCtx({ key: 'rent-boardwalk', userId: 1, statusCode: HttpStatus.OK });
      const next = { handle: jest.fn().mockReturnValue(of(rentResult)) };

      const obs$ = await interceptor.intercept(ctx, next as any);
      await new Promise((res) => obs$.subscribe({ complete: res as any }));

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'idempotency:1:rent-boardwalk',
        expect.objectContaining({ body: rentResult }),
        86400,
      );
    });
  });

  // ── POST /games/:gameId/players/:playerId/pay-tax ─────────────────────────

  describe('POST pay-tax — pay tax idempotency', () => {
    const taxResult = { player: { id: 1, balance: 1300 }, finalTax: 200 };

    it('replay: returns cached tax payment without deducting again', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.OK,
        body: taxResult,
      });
      const ctx = buildCtx({ key: 'tax-luxury', userId: 1 });
      const next = { handle: jest.fn() };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(taxResult);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('missing key on pay-tax endpoint throws 400', async () => {
      asIdempotent();
      const ctx = buildCtx({ userId: 1, omitKey: true });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── POST /games/:gameId/players/:playerId/buy-property ────────────────────

  describe('POST buy-property — buy property idempotency', () => {
    const purchaseResult = { id: 1, balance: 900 };

    it('replay: returns cached player without re-purchasing property', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.OK,
        body: purchaseResult,
      });
      const ctx = buildCtx({ key: 'buy-park-place', userId: 1 });
      const next = { handle: jest.fn() };

      const obs$ = await interceptor.intercept(ctx, next as any);
      const result = await collectEmitted(obs$);

      expect(result).toEqual(purchaseResult);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('first purchase: handler called once and lock released afterwards', async () => {
      asIdempotent();
      firstCallSetup();
      const ctx = buildCtx({ key: 'buy-boardwalk', userId: 1, statusCode: HttpStatus.OK });
      const next = { handle: jest.fn().mockReturnValue(of(purchaseResult)) };

      const obs$ = await interceptor.intercept(ctx, next as any);
      await new Promise((res) => obs$.subscribe({ complete: res as any }));

      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'idempotency:1:buy-boardwalk:lock',
      );
    });

    it('concurrent purchase with same key is rejected', async () => {
      asIdempotent();
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(2);
      const ctx = buildCtx({ key: 'buy-concurrent', userId: 1 });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        'A request with this idempotency key is already in progress',
      );
    });

    it('missing key on buy-property endpoint throws 400', async () => {
      asIdempotent();
      const ctx = buildCtx({ userId: 1, omitKey: true });
      const next = { handle: jest.fn() };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── Non-idempotent endpoints pass through without caching ─────────────────

  describe('Non-idempotent game endpoints (GET, PATCH, DELETE)', () => {
    it('GET /games: passes through without touching Redis', async () => {
      asNonIdempotent();
      const ctx = buildCtx({ key: 'ignored' });
      const next = { handle: jest.fn().mockReturnValue(of([{ id: 1 }])) };

      await interceptor.intercept(ctx, next as any);

      expect(next.handle).toHaveBeenCalled();
      expect(mockRedisService.get).not.toHaveBeenCalled();
    });

    it('PATCH /games/:id: passes through without touching Redis', async () => {
      asNonIdempotent();
      const ctx = buildCtx({ key: 'also-ignored' });
      const next = { handle: jest.fn().mockReturnValue(of({ id: 1, status: 'RUNNING' })) };

      await interceptor.intercept(ctx, next as any);

      expect(next.handle).toHaveBeenCalled();
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('DELETE /games/:gameId/players/me: passes through without touching Redis', async () => {
      asNonIdempotent();
      const ctx = buildCtx({ key: 'leave-key' });
      const next = { handle: jest.fn().mockReturnValue(of(null)) };

      await interceptor.intercept(ctx, next as any);

      expect(next.handle).toHaveBeenCalled();
      expect(mockRedisService.get).not.toHaveBeenCalled();
    });
  });
});
