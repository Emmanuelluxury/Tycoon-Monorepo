import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Game, GameMode, GameStatus } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { GamePlayer } from './entities/game-player.entity';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { JoinGameDto } from './dto/join-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { UpdateGameSettingsDto } from './dto/update-game-settings.dto';
import { PaginationService } from '../../common';
import { GetGamesDto, GameSortField } from './dto/get-games.dto';

describe('GamesService', () => {
  let service: GamesService;

  const mockGetOne = jest.fn();
  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: mockGetOne,
  };

  const mockGameRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockGameSettingsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  // Mock GamePlayerRepository to resolve dependency injection
  const mockGamePlayerRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GameSettings),
          useValue: mockGameSettingsRepository,
        },
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a game with relations when found', async () => {
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        status: GameStatus.PENDING,
        creator: { id: 1, email: 'user@example.com', username: 'player1' },
        winner: null,
        nextPlayer: null,
        settings: {},
      };

      mockGetOne.mockResolvedValue(mockGame);

      const result = await service.findById(1);

      expect(mockGameRepository.createQueryBuilder).toHaveBeenCalledWith('g');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'g.creator',
        'creator',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'g.winner',
        'winner',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'g.nextPlayer',
        'nextPlayer',
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'g.settings',
        'settings',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('g.id = :id', {
        id: 1,
      });
      expect(mockQueryBuilder.getOne).toHaveBeenCalled();
      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException when game not found', async () => {
      mockGetOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow(
        'Game with ID 999 not found',
      );
    });
  });

  describe('findByCode', () => {
    it('should return a game with relations when found', async () => {
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        status: GameStatus.PENDING,
        creator: { id: 1, email: 'user@example.com', username: 'player1' },
        winner: null,
        nextPlayer: null,
        settings: {},
      };

      mockGetOne.mockResolvedValue(mockGame);

      const result = await service.findByCode('abc123');

      expect(mockGameRepository.createQueryBuilder).toHaveBeenCalledWith('g');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('g.code = :code', {
        code: 'ABC123',
      });
      expect(mockQueryBuilder.getOne).toHaveBeenCalled();
      expect(result).toEqual(mockGame);
    });

    it('should throw NotFoundException when game not found', async () => {
      mockGetOne.mockResolvedValue(null);

      await expect(service.findByCode('NOTFOUND')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByCode('NOTFOUND')).rejects.toThrow(
        'Game with code NOTFOUND not found',
      );
    });

    it('should convert code to uppercase before searching', async () => {
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        status: GameStatus.PENDING,
        creator: { id: 1, email: 'user@example.com' },
        winner: null,
        nextPlayer: null,
        settings: {},
      };

      mockGetOne.mockResolvedValue(mockGame);

      await service.findByCode('abc123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('g.code = :code', {
        code: 'ABC123',
      });
    });
  });

  describe('create', () => {
    it('should create a game with default settings', async () => {
      const dto: CreateGameDto = {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 4,
      };
      const creatorId = 1;

      // Mock unique code check
      mockGameRepository.findOne.mockResolvedValue(null);

      // Mock game creation
      const mockGame = {
        id: 1,
        code: 'ABC123',
        mode: GameMode.PUBLIC,
        number_of_players: 4,
        creator_id: creatorId,
        status: GameStatus.PENDING,
        is_ai: false,
        is_minipay: false,
        chain: null,
        contract_game_id: null,
        created_at: new Date(),
        settings: {
          auction: true,
          rentInPrison: false,
          mortgage: true,
          evenBuild: true,
          randomizePlayOrder: true,
          startingCash: 1500,
        },
      };
      mockQueryRunner.manager.create.mockReturnValue(mockGame);
      mockQueryRunner.manager.save.mockResolvedValue(mockGame);

      mockQueryRunner.manager.create.mockReturnValueOnce(mockGame);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockGame);

      const result = await service.create(dto, creatorId);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('code');
      expect(result.mode).toBe(GameMode.PUBLIC);
      expect(result.number_of_players).toBe(4);
      expect(result.creator_id).toBe(creatorId);
      expect(result.is_ai).toBe(false);
      expect(result.is_minipay).toBe(false);
    });

    it('should create a game with AI and MiniPay flags', async () => {
      const dto: CreateGameDto = {
        mode: GameMode.PRIVATE,
        numberOfPlayers: 2,
        is_ai: true,
        is_minipay: true,
        chain: 'ethereum',
        contract_game_id: '0x123abc',
      };
      const creatorId = 2;

      mockGameRepository.findOne.mockResolvedValue(null);

      const mockGame = {
        id: 2,
        code: 'XYZ789',
        mode: GameMode.PRIVATE,
        number_of_players: 2,
        creator_id: creatorId,
        status: GameStatus.PENDING,
        is_ai: true,
        is_minipay: true,
        chain: 'ethereum',
        contract_game_id: '0x123abc',
        created_at: new Date(),
        settings: {
          auction: true,
          rentInPrison: false,
          mortgage: true,
          evenBuild: true,
          randomizePlayOrder: true,
          startingCash: 1500,
        },
      };
      mockQueryRunner.manager.create.mockReturnValue(mockGame);
      mockQueryRunner.manager.save.mockResolvedValue(mockGame);

      mockQueryRunner.manager.create.mockReturnValueOnce(mockGame);
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockGame);

      const result = await service.create(dto, creatorId);

      expect(result.is_ai).toBe(true);
      expect(result.is_minipay).toBe(true);
      expect(result.chain).toBe('ethereum');
      expect(result.contract_game_id).toBe('0x123abc');
    });

    it('should rollback transaction on error', async () => {
      const dto: CreateGameDto = {
        mode: GameMode.PUBLIC,
        numberOfPlayers: 4,
      };
      const creatorId = 1;

      mockGameRepository.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.create(dto, creatorId)).rejects.toThrow(
        'Database error',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
    };

    beforeEach(() => {
      mockGameRepository.createQueryBuilder.mockReturnValue(qb);
    });

    it('should build query with all supported filters and paginate', async () => {
      const dto: GetGamesDto = {
        userId: 3,
        status: GameStatus.RUNNING,
        mode: GameMode.PUBLIC,
        isAi: true,
        isMinipay: false,
        chain: 'base',
        activeOnly: true,
        startedOrPending: true,
        page: 2,
        limit: 5,
      };

      const paginatedResult = {
        data: [],
        meta: {
          page: 2,
          limit: 5,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      };

      mockPaginationService.paginate.mockResolvedValue(paginatedResult);

      const result = await service.findAll(dto);

      expect(mockGameRepository.createQueryBuilder).toHaveBeenCalledWith('g');
      expect(qb.andWhere).toHaveBeenCalledWith('g.creator_id = :userId', {
        userId: 3,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.status = :status', {
        status: GameStatus.RUNNING,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.mode = :mode', {
        mode: GameMode.PUBLIC,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.is_ai = :isAi', {
        isAi: true,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.is_minipay = :isMinipay', {
        isMinipay: false,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.chain = :chain', {
        chain: 'base',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('g.status = :activeStatus', {
        activeStatus: GameStatus.RUNNING,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'g.status IN (:...startedStatuses)',
        {
          startedStatuses: [GameStatus.PENDING, GameStatus.RUNNING],
        },
      );

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        qb,
        expect.objectContaining({ page: 2, limit: 5 }),
        ['code', 'chain'],
      );
      expect(result).toEqual(paginatedResult);
    });

    it('should use created_at as default sortBy when not provided', async () => {
      const dto: GetGamesDto = {};
      mockPaginationService.paginate.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
      });

      await service.findAll(dto);

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        qb,
        expect.objectContaining({ sortBy: GameSortField.CREATED_AT }),
        ['code', 'chain'],
      );
    });

    it('should pass explicit sortBy field through to paginate', async () => {
      const dto: GetGamesDto = { sortBy: GameSortField.STATUS };
      mockPaginationService.paginate.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
      });

      await service.findAll(dto);

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        qb,
        expect.objectContaining({ sortBy: GameSortField.STATUS }),
        ['code', 'chain'],
      );
    });

    it('should pass explicit sortBy=started_at through to paginate', async () => {
      const dto: GetGamesDto = { sortBy: GameSortField.STARTED_AT };
      mockPaginationService.paginate.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
      });

      await service.findAll(dto);

      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        qb,
        expect.objectContaining({ sortBy: GameSortField.STARTED_AT }),
        ['code', 'chain'],
      );
    });
  });

  // ── joinGame ────────────────────────────────────────────────────────────────

  describe('joinGame', () => {
    const dto: JoinGameDto = {};

    it('should throw NotFoundException when game not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.joinGame(999, 1, dto)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw BadRequestException when game is not PENDING', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 1,
        status: GameStatus.RUNNING,
        number_of_players: 4,
        settings: { startingCash: 1500, randomizePlayOrder: true },
      });

      await expect(service.joinGame(1, 1, dto)).rejects.toThrow(
        'Cannot join game that is not in PENDING status',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when game is full', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 1,
        status: GameStatus.PENDING,
        number_of_players: 2,
        settings: { startingCash: 1500, randomizePlayOrder: false },
      });
      mockQueryRunner.manager.count.mockResolvedValue(2);

      await expect(service.joinGame(1, 1, dto)).rejects.toThrow('Game is full');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when user already joined — idempotency guard', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({
          id: 1,
          status: GameStatus.PENDING,
          number_of_players: 4,
          settings: { startingCash: 1500, randomizePlayOrder: false },
        })
        .mockResolvedValueOnce({ id: 5, game_id: 1, user_id: 1 });
      mockQueryRunner.manager.count.mockResolvedValue(1);

      await expect(service.joinGame(1, 1, dto)).rejects.toThrow(
        'User already joined this game',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should create and return a player with starting cash from settings', async () => {
      const mockGame = {
        id: 1,
        status: GameStatus.PENDING,
        number_of_players: 4,
        settings: { startingCash: 2000, randomizePlayOrder: true },
      };
      const mockPlayer = { id: 10, game_id: 1, user_id: 42, balance: 2000, turn_order: 2 };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.count.mockResolvedValue(1);
      mockQueryRunner.manager.create.mockReturnValue(mockPlayer);
      mockQueryRunner.manager.save.mockResolvedValue(mockPlayer);

      const result = await service.joinGame(1, 42, dto);

      expect(result).toEqual(mockPlayer);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on DB error', async () => {
      mockQueryRunner.manager.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.joinGame(1, 1, dto)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const baseGame = {
      id: 1,
      code: 'GAME01',
      status: GameStatus.PENDING,
      creator_id: 1,
      creator: null,
      winner: null,
      nextPlayer: null,
      settings: {},
    };

    it('should throw ForbiddenException when non-creator non-admin updates', async () => {
      mockGetOne.mockResolvedValue(baseGame);
      const dto: UpdateGameDto = { status: GameStatus.RUNNING };

      await expect(service.update(1, dto, 99, 'user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to update any game regardless of ownership', async () => {
      const updatedGame = { ...baseGame, status: GameStatus.RUNNING };
      mockGetOne
        .mockResolvedValueOnce(baseGame)
        .mockResolvedValueOnce(updatedGame);
      mockGameRepository.update.mockResolvedValue(undefined);
      const dto: UpdateGameDto = { status: GameStatus.RUNNING };

      const result = await service.update(1, dto, 99, 'admin');

      expect(mockGameRepository.update).toHaveBeenCalled();
      expect(result).toEqual(updatedGame);
    });

    it('should throw BadRequestException when transitioning FINISHED → RUNNING', async () => {
      mockGetOne.mockResolvedValue({ ...baseGame, status: GameStatus.FINISHED });
      const dto: UpdateGameDto = { status: GameStatus.RUNNING };

      await expect(service.update(1, dto, 1, 'user')).rejects.toThrow(
        'Cannot transition game status from FINISHED to RUNNING',
      );
    });

    it('should throw BadRequestException when transitioning CANCELLED → RUNNING', async () => {
      mockGetOne.mockResolvedValue({ ...baseGame, status: GameStatus.CANCELLED });
      const dto: UpdateGameDto = { status: GameStatus.RUNNING };

      await expect(service.update(1, dto, 1, 'user')).rejects.toThrow(
        'Cannot transition game status from CANCELLED to RUNNING',
      );
    });

    it('should return game unchanged when no update fields are provided', async () => {
      mockGetOne.mockResolvedValue(baseGame);
      const dto: UpdateGameDto = {};

      const result = await service.update(1, dto, 1, 'user');

      expect(mockGameRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(baseGame);
    });

    it('should update multiple fields and return the refreshed game', async () => {
      const updatedGame = { ...baseGame, status: GameStatus.RUNNING, next_player_id: 5 };
      mockGetOne
        .mockResolvedValueOnce(baseGame)
        .mockResolvedValueOnce(updatedGame);
      mockGameRepository.update.mockResolvedValue(undefined);
      const dto: UpdateGameDto = { status: GameStatus.RUNNING, nextPlayerId: 5 };

      const result = await service.update(1, dto, 1, 'user');

      expect(mockGameRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: GameStatus.RUNNING, next_player_id: 5 }),
      );
      expect(result).toEqual(updatedGame);
    });
  });

  // ── updateSettings ──────────────────────────────────────────────────────────

  describe('updateSettings', () => {
    const pendingGame = {
      id: 1,
      code: 'GAME01',
      status: GameStatus.PENDING,
      creator_id: 1,
      settings: {
        id: 10,
        auction: true,
        rentInPrison: false,
        mortgage: true,
        evenBuild: true,
        randomizePlayOrder: true,
        startingCash: 1500,
      },
      creator: null,
      winner: null,
      nextPlayer: null,
    };

    it('should throw ForbiddenException when non-creator updates settings', async () => {
      mockGetOne.mockResolvedValue(pendingGame);
      const dto: UpdateGameSettingsDto = { auction: false };

      await expect(service.updateSettings(1, dto, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when game is not PENDING', async () => {
      mockGetOne.mockResolvedValue({ ...pendingGame, status: GameStatus.RUNNING });
      const dto: UpdateGameSettingsDto = { startingCash: 2000 };

      await expect(service.updateSettings(1, dto, 1)).rejects.toThrow(
        'Cannot update settings after the game has started',
      );
    });

    it('should throw NotFoundException when settings are missing', async () => {
      mockGetOne.mockResolvedValue({ ...pendingGame, settings: null });
      const dto: UpdateGameSettingsDto = { auction: false };

      await expect(service.updateSettings(1, dto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return game unchanged when no update fields are provided', async () => {
      mockGetOne.mockResolvedValue(pendingGame);
      const dto: UpdateGameSettingsDto = {};

      const result = await service.updateSettings(1, dto, 1);

      expect(mockGameSettingsRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(pendingGame);
    });

    it('should update settings fields and return the refreshed game', async () => {
      const updatedGame = {
        ...pendingGame,
        settings: { ...pendingGame.settings, startingCash: 2000 },
      };
      mockGetOne
        .mockResolvedValueOnce(pendingGame)
        .mockResolvedValueOnce(updatedGame);
      mockGameSettingsRepository.update.mockResolvedValue(undefined);
      const dto: UpdateGameSettingsDto = { startingCash: 2000 };

      const result = await service.updateSettings(1, dto, 1);

      expect(mockGameSettingsRepository.update).toHaveBeenCalledWith(
        10,
        { startingCash: 2000 },
      );
      expect(result).toEqual(updatedGame);
    });
  });

  // ── getSafeGameView ─────────────────────────────────────────────────────────

  describe('getSafeGameView', () => {
    it('returns default view when no id provided — replay-safe', async () => {
      const result = await service.getSafeGameView();

      expect(result).toMatchObject({
        id: 0,
        code: '',
        status: GameStatus.PENDING,
        players: [],
        settings: expect.objectContaining({ startingCash: 1500 }),
        number_of_players: 4,
        is_ai: false,
      });
    });

    it('returns default view when game not found — replay-safe fallback', async () => {
      mockGetOne.mockResolvedValue(null);

      const result = await service.getSafeGameView(999);

      expect(result).toMatchObject({
        id: 0,
        code: '',
        status: GameStatus.PENDING,
        players: [],
      });
    });

    it('returns populated view for an existing game', async () => {
      const mockGame = {
        id: 5,
        code: 'GAME05',
        status: GameStatus.RUNNING,
        settings: { startingCash: 2000, auction: true, rentInPrison: false, mortgage: true, evenBuild: true, randomizePlayOrder: true },
        players: [{ id: 1 }],
        creator: { id: 1, username: 'alice' },
        winner: null,
        nextPlayer: { id: 1 },
        placements: null,
        number_of_players: 4,
        is_ai: false,
        chain: 'base',
      };
      mockGetOne.mockResolvedValue(mockGame);

      const result = await service.getSafeGameView(5);

      expect(result.id).toBe(5);
      expect(result.code).toBe('GAME05');
      expect(result.status).toBe(GameStatus.RUNNING);
      expect(result.settings.startingCash).toBe(2000);
      expect(result.players).toHaveLength(1);
      expect(result.chain).toBe('base');
    });

    it('fills missing fields with safe defaults', async () => {
      const partialGame = {
        id: 3,
        code: 'PART03',
        status: GameStatus.PENDING,
        settings: null,
        players: null,
        creator: null,
        winner: null,
        nextPlayer: null,
        placements: null,
        number_of_players: null,
        is_ai: null,
        chain: null,
      };
      mockGetOne.mockResolvedValue(partialGame);

      const result = await service.getSafeGameView(3);

      expect(result.settings).toMatchObject({ startingCash: 1500 });
      expect(result.players).toEqual([]);
      expect(result.number_of_players).toBe(4);
      expect(result.is_ai).toBe(false);
      expect(result.placements).toEqual({});
    });
  });
});
