import { Test, TestingModule } from '@nestjs/testing';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamePlayersService } from './game-players.service';
import { GamesAuditService } from './audit/games-audit.service';
import { GamesAuditInterceptor } from './audit/games-audit.interceptor';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { RedisService } from '../redis/redis.service';
import { Reflector } from '@nestjs/core';

/**
 * SW-BE-017: Audit trail hook unit tests.
 * Verifies that GamesAuditService methods are invoked for key controller operations.
 */

const flushAsync = () => new Promise<void>((r) => setImmediate(r));

describe('GamesController — audit hooks (SW-BE-017)', () => {
  let controller: GamesController;
  let auditService: jest.Mocked<GamesAuditService>;

  const mockGame = {
    id: 1,
    code: 'ABC123',
    mode: 'PUBLIC',
    number_of_players: 4,
    is_ai: false,
    is_minipay: false,
    chain: null,
    contract_game_id: null,
    settings: { startingCash: 1500, auction: true, rentInPrison: false, mortgage: true, evenBuild: true, randomizePlayOrder: true },
  };

  const fakeReq = (userId = 1, role = 'user') =>
    ({
      user: { id: userId, role },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        {
          provide: GamesService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockGame),
            joinGame: jest.fn().mockResolvedValue({ id: 10 }),
            update: jest.fn().mockResolvedValue(mockGame),
            updateSettings: jest.fn().mockResolvedValue(mockGame),
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCode: jest.fn(),
          },
        },
        {
          provide: GamePlayersService,
          useValue: {
            rollDice: jest.fn().mockResolvedValue({}),
            payRent: jest.fn().mockResolvedValue({}),
            payTax: jest.fn().mockResolvedValue({}),
            buyProperty: jest.fn().mockResolvedValue({}),
            leaveGameForUser: jest.fn().mockResolvedValue(undefined),
            findPlayersByGame: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: GamesAuditService,
          useValue: {
            logGameCreation: jest.fn().mockResolvedValue(undefined),
            logGameJoin: jest.fn().mockResolvedValue(undefined),
            logGameUpdate: jest.fn().mockResolvedValue(undefined),
            logGameSettingsUpdate: jest.fn().mockResolvedValue(undefined),
            logDiceRoll: jest.fn().mockResolvedValue(undefined),
            logRentPayment: jest.fn().mockResolvedValue(undefined),
            logTaxPayment: jest.fn().mockResolvedValue(undefined),
            logPropertyPurchase: jest.fn().mockResolvedValue(undefined),
            logGameLeave: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: GamesAuditInterceptor,
          useValue: { intercept: (_: any, next: any) => next.handle() },
        },
        {
          provide: IdempotencyInterceptor,
          useValue: { intercept: (_: any, next: any) => next.handle() },
        },
        { provide: RedisService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<GamesController>(GamesController);
    auditService = module.get(GamesAuditService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  it('logGameCreation called after create', async () => {
    await controller.create({ mode: 'PUBLIC' as any, numberOfPlayers: 4 }, fakeReq());
    await flushAsync();
    expect(auditService.logGameCreation).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'create_game', gameId: 1, gameCode: 'ABC123' }),
    );
  });

  // ─── joinGame ─────────────────────────────────────────────────────────────

  it('logGameJoin called with result=success on successful join', async () => {
    await controller.joinGame(1, {}, fakeReq());
    await flushAsync();
    expect(auditService.logGameJoin).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'join_game', gameId: 1, result: 'success' }),
    );
  });

  it('logGameJoin called with result=failure when service throws', async () => {
    const gamesService = (controller as any).gamesService;
    gamesService.joinGame.mockRejectedValueOnce(new Error('Game is full'));

    await expect(controller.joinGame(1, {}, fakeReq())).rejects.toThrow('Game is full');
    await flushAsync();
    expect(auditService.logGameJoin).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'failure', reason: 'Game is full' }),
    );
  });

  // ─── update ───────────────────────────────────────────────────────────────

  it('logGameUpdate called after update', async () => {
    await controller.update(1, { status: 'RUNNING' as any }, fakeReq());
    await flushAsync();
    expect(auditService.logGameUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'update_game', gameId: 1, newStatus: 'RUNNING' }),
    );
  });

  // ─── updateSettings ───────────────────────────────────────────────────────

  it('logGameSettingsUpdate called after updateSettings', async () => {
    await controller.updateSettings(1, { auction: false } as any, fakeReq());
    await flushAsync();
    expect(auditService.logGameSettingsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'update_game_settings', gameId: 1 }),
    );
  });

  // ─── rollDice ─────────────────────────────────────────────────────────────

  it('logDiceRoll called with correct values', async () => {
    await controller.rollDice(1, 10, { dice1: 3, dice2: 4 });
    await flushAsync();
    expect(auditService.logDiceRoll).toHaveBeenCalledWith(
      expect.objectContaining({ dice1: 3, dice2: 4, total: 7, isDoubles: false }),
    );
  });

  it('logDiceRoll marks doubles correctly', async () => {
    await controller.rollDice(1, 10, { dice1: 5, dice2: 5 });
    await flushAsync();
    expect(auditService.logDiceRoll).toHaveBeenCalledWith(
      expect.objectContaining({ isDoubles: true, total: 10 }),
    );
  });

  // ─── payRent ──────────────────────────────────────────────────────────────

  it('logRentPayment called with correct fields', async () => {
    await controller.payRent(1, 10, { payeeId: 2, baseRent: 50 });
    await flushAsync();
    expect(auditService.logRentPayment).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 1, playerId: 10, payeeId: 2, baseRent: 50 }),
    );
  });

  // ─── payTax ───────────────────────────────────────────────────────────────

  it('logTaxPayment called with correct fields', async () => {
    await controller.payTax(1, 10, { baseTax: 75 });
    await flushAsync();
    expect(auditService.logTaxPayment).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 1, playerId: 10, baseTax: 75 }),
    );
  });

  // ─── buyProperty ──────────────────────────────────────────────────────────

  it('logPropertyPurchase called with correct fields', async () => {
    await controller.buyProperty(1, 10, { propertyCost: 200, propertyId: 5 });
    await flushAsync();
    expect(auditService.logPropertyPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 1, playerId: 10, propertyId: '5', cost: 200 }),
    );
  });

  // ─── leaveGame ────────────────────────────────────────────────────────────

  it('logGameLeave called after leaveGame', async () => {
    await controller.leaveGame(1, fakeReq());
    await flushAsync();
    expect(auditService.logGameLeave).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'leave_game', gameId: 1 }),
    );
  });
});
