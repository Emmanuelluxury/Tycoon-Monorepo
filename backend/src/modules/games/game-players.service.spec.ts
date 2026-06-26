import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamePlayersService } from './game-players.service';
import { Game, GameStatus } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { PaginationService } from '../../common/services/pagination.service';
import { BoostService } from '../perks-boosts/services/boost.service';
import {
  PerkBoostEvent,
  PerksBoostsEvents,
} from '../perks-boosts/services/perks-boosts-events.service';

describe('GamePlayersService', () => {
  let service: GamePlayersService;
  let gameRepository: Repository<Game>;
  let gamePlayerRepository: Repository<GamePlayer>;

  const mockGameRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockGamePlayerRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const makeMockPlayer = (overrides: Partial<GamePlayer> = {}): GamePlayer =>
    ({
      id: 1,
      game_id: 1,
      user_id: 1,
      balance: 1500,
      position: 0,
      turn_order: 1,
      in_jail: false,
      in_jail_rolls: 0,
      rolls: 0,
      circle: 0,
      rolled: null,
      turn_start: null,
      consecutive_timeouts: 0,
      turn_count: 0,
      last_timeout_turn_start: null,
      trade_locked_balance: '0.00',
      address: null,
      symbol: null,
      chance_jail_card: false,
      community_chest_jail_card: false,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    } as GamePlayer);

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  const mockBoostService = {
    calculateModifiedValue: jest.fn().mockResolvedValue(0),
  };

  const mockEventsService = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamePlayersService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
        {
          provide: BoostService,
          useValue: mockBoostService,
        },
        {
          provide: PerksBoostsEvents,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    service = module.get<GamePlayersService>(GamePlayersService);
    gameRepository = module.get<Repository<Game>>(getRepositoryToken(Game));
    gamePlayerRepository = module.get<Repository<GamePlayer>>(
      getRepositoryToken(GamePlayer),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('advanceTurn', () => {
    it('rotates to the next non-jailed player and updates next_player_id', async () => {
      const game: Game = {
        id: 1,
        code: 'ABC123',
        mode: null,
        creator_id: 1,
        status: null,
        winner_id: null,
        number_of_players: 3,
        next_player_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        is_ai: false,
        is_minipay: false,
        chain: null,
        duration: null,
        started_at: null,
        contract_game_id: null,
        placements: null,
        creator: null,
        winner: null,
        nextPlayer: null,
      } as unknown as Game;

      const players: GamePlayer[] = [
        {
          id: 1,
          game_id: 1,
          user_id: 1,
          symbol: 'A',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 1,
          turn_start: '100',
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
        {
          id: 2,
          game_id: 1,
          user_id: 2,
          symbol: 'B',
          position: 0,
          balance: 0,
          in_jail: true,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 2,
          turn_start: null,
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
        {
          id: 3,
          game_id: 1,
          user_id: 3,
          symbol: 'C',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 3,
          turn_start: null,
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
      ];

      mockGameRepository.findOne.mockResolvedValue(game);
      mockGameRepository.save.mockImplementation(async (g) => g);
      mockGamePlayerRepository.find.mockResolvedValue(players);
      mockGamePlayerRepository.save.mockImplementation(
        async (entities) => entities,
      );

      await service.advanceTurn(1, 1, { isTimeout: false, now: '200' });

      expect(gamePlayerRepository.find).toHaveBeenCalledWith({
        where: { game_id: 1 },
        order: { turn_order: 'ASC' },
      });

      expect(gamePlayerRepository.save).toHaveBeenCalledTimes(1);
      const savedArgs = (gamePlayerRepository.save as jest.Mock).mock
        .calls[0][0];
      const [savedCurrent, savedNext] = savedArgs as GamePlayer[];

      expect(savedCurrent.user_id).toBe(1);
      expect(savedCurrent.turn_start).toBeNull();
      expect(savedCurrent.consecutive_timeouts).toBe(0);

      expect(savedNext.user_id).toBe(3);
      expect(savedNext.turn_start).toBe('200');
      expect(savedNext.turn_count).toBe(1);
      expect(savedNext.consecutive_timeouts).toBe(0);
      expect(savedNext.rolled).toBe(0);

      expect(gameRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          next_player_id: 3,
        }),
      );
    });

    it('increments consecutive_timeouts on timeout', async () => {
      const game: Game = {
        id: 1,
        code: 'ABC123',
        mode: null,
        creator_id: 1,
        status: null,
        winner_id: null,
        number_of_players: 2,
        next_player_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        is_ai: false,
        is_minipay: false,
        chain: null,
        duration: null,
        started_at: null,
        contract_game_id: null,
        placements: null,
        creator: null,
        winner: null,
        nextPlayer: null,
      } as unknown as Game;

      const players: GamePlayer[] = [
        {
          id: 1,
          game_id: 1,
          user_id: 1,
          symbol: 'A',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 1,
          turn_start: '100',
          consecutive_timeouts: 1,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
        {
          id: 2,
          game_id: 1,
          user_id: 2,
          symbol: 'B',
          position: 0,
          balance: 0,
          in_jail: false,
          in_jail_rolls: 0,
          circle: 0,
          turn_order: 2,
          turn_start: null,
          consecutive_timeouts: 0,
          turn_count: 0,
          last_timeout_turn_start: null,
          trade_locked_balance: '0.00',
          rolled: null,
          address: null,
        } as unknown as GamePlayer,
      ];

      mockGameRepository.findOne.mockResolvedValue(game);
      mockGameRepository.save.mockImplementation(async (g) => g);
      mockGamePlayerRepository.find.mockResolvedValue(players);
      mockGamePlayerRepository.save.mockImplementation(
        async (entities) => entities,
      );

      await service.advanceTurn(1, 1, { isTimeout: true, now: '200' });

      const savedArgs = (gamePlayerRepository.save as jest.Mock).mock
        .calls[0][0];
      const [savedCurrent, savedNext] = savedArgs as GamePlayer[];

      expect(savedCurrent.user_id).toBe(1);
      expect(savedCurrent.consecutive_timeouts).toBe(2);
      expect(savedCurrent.last_timeout_turn_start).toBe('100');
      expect(savedCurrent.turn_start).toBeNull();

      expect(savedNext.user_id).toBe(2);
      expect(savedNext.turn_start).toBe('200');
      expect(savedNext.turn_count).toBe(1);
      expect(savedNext.rolled).toBe(0);
    });
  });

  // ── getAvailableBalance ────────────────────────────────────────────────────

  describe('getAvailableBalance', () => {
    it('returns balance minus locked amount', () => {
      const player = makeMockPlayer({ balance: 1500, trade_locked_balance: '200.00' });
      expect(service.getAvailableBalance(player)).toBe(1300);
    });

    it('clamps to 0 when locked exceeds balance', () => {
      const player = makeMockPlayer({ balance: 100, trade_locked_balance: '500.00' });
      expect(service.getAvailableBalance(player)).toBe(0);
    });

    it('returns full balance when nothing is locked', () => {
      const player = makeMockPlayer({ balance: 1500, trade_locked_balance: '0.00' });
      expect(service.getAvailableBalance(player)).toBe(1500);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns player when found', async () => {
      const player = makeMockPlayer({ id: 5 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);

      const result = await service.findOne(5);

      expect(result).toEqual(player);
      expect(mockGamePlayerRepository.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('throws NotFoundException when player not found', async () => {
      mockGamePlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Game player 999 not found');
    });
  });

  // ── findByGameAndPlayer ────────────────────────────────────────────────────

  describe('findByGameAndPlayer', () => {
    it('returns player when found in the specified game', async () => {
      const player = makeMockPlayer({ id: 3, game_id: 10 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);

      const result = await service.findByGameAndPlayer(10, 3);

      expect(result).toEqual(player);
    });

    it('throws NotFoundException when player not found in game', async () => {
      mockGamePlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.findByGameAndPlayer(10, 99)).rejects.toThrow(NotFoundException);
      await expect(service.findByGameAndPlayer(10, 99)).rejects.toThrow(
        'Game player 99 not found in game 10',
      );
    });
  });

  // ── lockBalance ────────────────────────────────────────────────────────────

  describe('lockBalance', () => {
    it('throws BadRequestException when amount is zero', async () => {
      await expect(service.lockBalance(1, 0)).rejects.toThrow(
        'Lock amount must be positive',
      );
    });

    it('throws BadRequestException when amount is negative', async () => {
      await expect(service.lockBalance(1, -50)).rejects.toThrow(
        'Lock amount must be positive',
      );
    });

    it('throws BadRequestException when amount exceeds available balance', async () => {
      const player = makeMockPlayer({ balance: 500, trade_locked_balance: '0.00' });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);

      await expect(service.lockBalance(1, 600)).rejects.toThrow(
        'Cannot lock 600: available balance is 500',
      );
    });

    it('increases trade_locked_balance by the specified amount', async () => {
      const player = makeMockPlayer({ balance: 1500, trade_locked_balance: '200.00' });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.lockBalance(1, 300);

      expect(player.trade_locked_balance).toBe('500.00');
    });
  });

  // ── unlockBalance ──────────────────────────────────────────────────────────

  describe('unlockBalance', () => {
    it('throws BadRequestException when amount is zero', async () => {
      await expect(service.unlockBalance(1, 0)).rejects.toThrow(
        'Unlock amount must be positive',
      );
    });

    it('throws BadRequestException when amount exceeds currently locked balance', async () => {
      const player = makeMockPlayer({ trade_locked_balance: '100.00' });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);

      await expect(service.unlockBalance(1, 200)).rejects.toThrow(
        'Cannot unlock 200: locked balance is 100',
      );
    });

    it('decreases trade_locked_balance by the specified amount', async () => {
      const player = makeMockPlayer({ balance: 1500, trade_locked_balance: '300.00' });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.unlockBalance(1, 100);

      expect(player.trade_locked_balance).toBe('200.00');
    });
  });

  // ── assertUserNotInGame ────────────────────────────────────────────────────

  describe('assertUserNotInGame', () => {
    it('throws ConflictException when user is already in game — idempotency guard', async () => {
      const existing = makeMockPlayer({ game_id: 1, user_id: 7 });
      mockGamePlayerRepository.findOne.mockResolvedValue(existing);

      await expect(service.assertUserNotInGame(1, 7)).rejects.toThrow(ConflictException);
      await expect(service.assertUserNotInGame(1, 7)).rejects.toThrow(
        'User is already a player in this game (duplicate join not allowed)',
      );
    });

    it('resolves without error when user has not joined yet', async () => {
      mockGamePlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.assertUserNotInGame(1, 7)).resolves.toBeUndefined();
    });
  });

  // ── addPlayerToGame ────────────────────────────────────────────────────────

  describe('addPlayerToGame', () => {
    it('throws NotFoundException when game not found', async () => {
      mockGameRepository.findOne.mockResolvedValue(null);

      await expect(service.addPlayerToGame(999, 1)).rejects.toThrow(NotFoundException);
      await expect(service.addPlayerToGame(999, 1)).rejects.toThrow('Game 999 not found');
    });

    it('throws BadRequestException when game is not PENDING', async () => {
      mockGameRepository.findOne.mockResolvedValue({
        id: 1,
        status: GameStatus.RUNNING,
        settings: { startingCash: 1500 },
      });

      await expect(service.addPlayerToGame(1, 1)).rejects.toThrow(
        'Cannot join game after it has started',
      );
    });

    it('throws ConflictException when user is already a player', async () => {
      mockGameRepository.findOne.mockResolvedValue({
        id: 1,
        status: GameStatus.PENDING,
        settings: { startingCash: 1500 },
      });
      const existing = makeMockPlayer({ game_id: 1, user_id: 7 });
      mockGamePlayerRepository.findOne.mockResolvedValue(existing);

      await expect(service.addPlayerToGame(1, 7)).rejects.toThrow(ConflictException);
    });

    it('creates and returns new player with starting cash from game settings', async () => {
      mockGameRepository.findOne.mockResolvedValue({
        id: 1,
        status: GameStatus.PENDING,
        settings: { startingCash: 1800 },
      });
      mockGamePlayerRepository.findOne.mockResolvedValue(null);
      const newPlayer = makeMockPlayer({ game_id: 1, user_id: 7, balance: 1800 });
      mockGamePlayerRepository.create.mockReturnValue(newPlayer);
      mockGamePlayerRepository.save.mockResolvedValue(newPlayer);

      const result = await service.addPlayerToGame(1, 7);

      expect(mockGamePlayerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ game_id: 1, user_id: 7, balance: 1800 }),
      );
      expect(result).toEqual(newPlayer);
    });
  });

  // ── rollDice ───────────────────────────────────────────────────────────────

  describe('rollDice', () => {
    beforeEach(() => {
      // Identity boost: modifiers pass the base value through unchanged
      mockBoostService.calculateModifiedValue.mockImplementation(
        async (params: { baseValue: number }) => params.baseValue,
      );
    });

    it('throws BadRequestException when player has already rolled — idempotency guard', async () => {
      mockGamePlayerRepository.findOne.mockResolvedValue(
        makeMockPlayer({ rolled: 1 }),
      );

      await expect(service.rollDice(1, 1, 3, 4)).rejects.toThrow(BadRequestException);
      await expect(service.rollDice(1, 1, 3, 4)).rejects.toThrow(
        'Player has already rolled this turn',
      );
    });

    it('moves player forward by the sum of the dice', async () => {
      const player = makeMockPlayer({ position: 0, rolled: null });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 3, 4);

      expect(player.position).toBe(7);
    });

    it('wraps position around the board (BOARD_SIZE = 40)', async () => {
      const player = makeMockPlayer({ position: 38, rolled: null, balance: 1500 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 3, 4); // 38 + 7 = 45 → 45 % 40 = 5

      expect(player.position).toBe(5);
    });

    it('awards GO bonus ($200) when player passes start', async () => {
      const player = makeMockPlayer({ position: 36, balance: 1500, rolled: null, circle: 0 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 3, 4); // 36 + 7 = 43 → 3, circle wraps

      expect(player.balance).toBe(1700);
      expect(player.circle).toBe(1);
    });

    it('marks player rolled=1 and increments roll count after turn', async () => {
      const player = makeMockPlayer({ position: 0, rolled: null, rolls: 0 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 2, 3);

      expect(player.rolled).toBe(1);
      expect(player.rolls).toBe(1);
    });

    it('releases player from jail on doubles', async () => {
      const player = makeMockPlayer({ in_jail: true, in_jail_rolls: 0, position: 10, rolled: null });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 3, 3); // doubles

      expect(player.in_jail).toBe(false);
      expect(player.in_jail_rolls).toBe(0);
    });

    it('releases player from jail after 3 failed non-doubles attempts (MAX_JAIL_ROLLS)', async () => {
      const player = makeMockPlayer({ in_jail: true, in_jail_rolls: 2, position: 10, rolled: null });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 1, 2); // 3rd attempt, not doubles

      expect(player.in_jail).toBe(false);
    });

    it('emits DICE_ROLLED event after a successful roll', async () => {
      const player = makeMockPlayer({ position: 0, rolled: null, user_id: 42 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.rollDice(1, 1, 2, 3);

      expect(mockEventsService.emit).toHaveBeenCalledWith(
        PerkBoostEvent.DICE_ROLLED,
        expect.objectContaining({ playerId: 42, gameId: 1 }),
      );
    });
  });

  // ── payRent ────────────────────────────────────────────────────────────────

  describe('payRent', () => {
    it('deducts rent from payer and credits payee', async () => {
      const payer = makeMockPlayer({ id: 1, user_id: 1, balance: 1500 });
      const payee = makeMockPlayer({ id: 2, user_id: 2, balance: 1000 });
      mockGamePlayerRepository.findOne
        .mockResolvedValueOnce(payer)
        .mockResolvedValueOnce(payee);
      mockBoostService.calculateModifiedValue.mockResolvedValue(200);
      mockGamePlayerRepository.save.mockImplementation(async (players: GamePlayer[]) => players);

      const result = await service.payRent(1, 1, 2, 200);

      expect(payer.balance).toBe(1300);
      expect(payee.balance).toBe(1200);
      expect(result.finalRent).toBe(200);
    });

    it('applies rent multiplier boost to the final amount', async () => {
      const payer = makeMockPlayer({ id: 1, user_id: 1, balance: 1500 });
      const payee = makeMockPlayer({ id: 2, user_id: 2, balance: 1000 });
      mockGamePlayerRepository.findOne
        .mockResolvedValueOnce(payer)
        .mockResolvedValueOnce(payee);
      mockBoostService.calculateModifiedValue.mockResolvedValue(400); // 2× boost
      mockGamePlayerRepository.save.mockImplementation(async (players: GamePlayer[]) => players);

      const result = await service.payRent(1, 1, 2, 200);

      expect(result.finalRent).toBe(400);
      expect(payer.balance).toBe(1100);
      expect(payee.balance).toBe(1400);
    });
  });

  // ── payTax ─────────────────────────────────────────────────────────────────

  describe('payTax', () => {
    it('deducts final tax amount from player balance', async () => {
      const player = makeMockPlayer({ balance: 1500 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockBoostService.calculateModifiedValue.mockResolvedValue(100);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      const result = await service.payTax(1, 1, 100);

      expect(player.balance).toBe(1400);
      expect(result.finalTax).toBe(100);
    });

    it('applies tax reduction boost to the final amount', async () => {
      const player = makeMockPlayer({ balance: 1500 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockBoostService.calculateModifiedValue.mockResolvedValue(50); // 50% reduction
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      const result = await service.payTax(1, 1, 100);

      expect(result.finalTax).toBe(50);
      expect(player.balance).toBe(1450);
    });
  });

  // ── buyProperty ────────────────────────────────────────────────────────────

  describe('buyProperty', () => {
    it('throws BadRequestException when player has insufficient balance — idempotency guard', async () => {
      const player = makeMockPlayer({ balance: 100 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);

      await expect(service.buyProperty(1, 1, 300, 5)).rejects.toThrow(
        'Not enough balance to buy property',
      );
    });

    it('deducts property cost from player balance on success', async () => {
      const player = makeMockPlayer({ balance: 1500 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.buyProperty(1, 1, 400, 5);

      expect(player.balance).toBe(1100);
    });

    it('emits PROPERTY_PURCHASE event after successful purchase', async () => {
      const player = makeMockPlayer({ balance: 1500, user_id: 1 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.save.mockImplementation(async (p: GamePlayer) => p);

      await service.buyProperty(1, 1, 400, 7);

      expect(mockEventsService.emit).toHaveBeenCalledWith(
        PerkBoostEvent.PROPERTY_PURCHASE,
        expect.objectContaining({
          playerId: 1,
          gameId: 1,
          metadata: { propertyId: 7, propertyCost: 400 },
        }),
      );
    });
  });

  // ── leaveGameForUser ───────────────────────────────────────────────────────

  describe('leaveGameForUser', () => {
    it('throws NotFoundException when game not found', async () => {
      mockGameRepository.findOne.mockResolvedValue(null);

      await expect(service.leaveGameForUser(999, 1)).rejects.toThrow(NotFoundException);
      await expect(service.leaveGameForUser(999, 1)).rejects.toThrow('Game 999 not found');
    });

    it('throws BadRequestException when game is not PENDING', async () => {
      mockGameRepository.findOne.mockResolvedValue({ id: 1, status: GameStatus.RUNNING });

      await expect(service.leaveGameForUser(1, 7)).rejects.toThrow(
        'Cannot leave game after it has started',
      );
    });

    it('throws NotFoundException when user is not a player in the game', async () => {
      mockGameRepository.findOne.mockResolvedValue({ id: 1, status: GameStatus.PENDING });
      mockGamePlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.leaveGameForUser(1, 7)).rejects.toThrow(NotFoundException);
      await expect(service.leaveGameForUser(1, 7)).rejects.toThrow(
        'User 7 is not a player in game 1',
      );
    });

    it('removes player and skips turn reorder when turn_order is null', async () => {
      mockGameRepository.findOne.mockResolvedValue({ id: 1, status: GameStatus.PENDING });
      const player = makeMockPlayer({ id: 5, game_id: 1, user_id: 7, turn_order: null });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.delete.mockResolvedValue(undefined);

      await service.leaveGameForUser(1, 7);

      expect(mockGamePlayerRepository.delete).toHaveBeenCalledWith(5);
      expect(mockGamePlayerRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('reorders subsequent players when leaving player has a turn slot', async () => {
      mockGameRepository.findOne.mockResolvedValue({ id: 1, status: GameStatus.PENDING });
      const player = makeMockPlayer({ id: 5, game_id: 1, user_id: 7, turn_order: 2 });
      mockGamePlayerRepository.findOne.mockResolvedValue(player);
      mockGamePlayerRepository.delete.mockResolvedValue(undefined);

      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockGamePlayerRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.leaveGameForUser(1, 7);

      expect(mockQb.execute).toHaveBeenCalled();
      expect(mockGamePlayerRepository.delete).toHaveBeenCalledWith(5);
    });
  });
});
