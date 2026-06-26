import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ChanceService } from './chance.service';
import { Chance } from './entities/chance.entity';
import { PaginationService } from '../../common';
import { ListChancesQueryDto } from './dto/list-chances-query.dto';
import { ChanceType } from './enums/chance-type.enum';

describe('ChanceService', () => {
  let service: ChanceService;
  let repository: Repository<Chance>;
  let paginationService: PaginationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChanceService,
        {
          provide: getRepositoryToken(Chance),
          useValue: {
            createQueryBuilder: jest.fn(),
            count: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: PaginationService,
          useValue: {
            paginate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChanceService>(ChanceService);
    repository = module.get<Repository<Chance>>(getRepositoryToken(Chance));
    paginationService = module.get<PaginationService>(PaginationService);
  });

  describe('findAll', () => {
    it('should return paginated chances with default pagination', async () => {
      const mockChances = [
        {
          id: 1,
          instruction: 'Go to jail',
          type: ChanceType.MOVE,
          amount: null,
          position: 10,
          extra: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const mockResponse = {
        data: mockChances,
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(paginationService, 'paginate').mockResolvedValue(mockResponse);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue({} as SelectQueryBuilder<Chance>);

      const queryDto = new ListChancesQueryDto();
      const result = await service.findAll(queryDto);

      expect(result).toEqual(mockResponse);
      expect(paginationService.paginate).toHaveBeenCalled();
    });

    it('should pass custom page and limit to pagination service', async () => {
      const mockResponse = {
        data: [],
        meta: {
          page: 2,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      };

      jest.spyOn(paginationService, 'paginate').mockResolvedValue(mockResponse);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue({} as SelectQueryBuilder<Chance>);

      const queryDto = new ListChancesQueryDto();
      queryDto.page = 2;
      queryDto.limit = 20;

      const result = await service.findAll(queryDto);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(20);
    });

    it('should enforce max limit of 100', async () => {
      const mockResponse = {
        data: [],
        meta: {
          page: 1,
          limit: 100,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(paginationService, 'paginate').mockResolvedValue(mockResponse);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue({} as SelectQueryBuilder<Chance>);

      const queryDto = new ListChancesQueryDto();
      queryDto.limit = 500; // Exceeds max

      await service.findAll(queryDto);

      expect(paginationService.paginate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 500 }),
        undefined,
        expect.any(Array),
      );
    });

    it('should allow sorting by allowed fields (id, createdAt, updatedAt)', async () => {
      const mockResponse = {
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(paginationService, 'paginate').mockResolvedValue(mockResponse);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue({} as SelectQueryBuilder<Chance>);

      const queryDto = new ListChancesQueryDto();
      queryDto.sortBy = 'createdAt';

      await service.findAll(queryDto);

      expect(paginationService.paginate).toHaveBeenCalledWith(
        expect.any(Object),
        queryDto,
        undefined,
        ['id', 'createdAt', 'updatedAt'],
      );
    });

    it('should return stable sorted results across pages', async () => {
      const page1Chances = [
        {
          id: 1,
          instruction: 'Card 1',
          type: ChanceType.REWARD,
          amount: 100,
          position: null,
          extra: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          instruction: 'Card 2',
          type: ChanceType.REWARD,
          amount: 100,
          position: null,
          extra: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const mockResponse = {
        data: page1Chances,
        meta: {
          page: 1,
          limit: 2,
          totalItems: 4,
          totalPages: 2,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(paginationService, 'paginate').mockResolvedValue(mockResponse);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue({} as SelectQueryBuilder<Chance>);

      const queryDto = new ListChancesQueryDto();
      queryDto.limit = 2;

      const result = await service.findAll(queryDto);

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(true);
    });

    it('should return empty results when no chances exist', async () => {
      const mockResponse = {
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      jest.spyOn(paginationService, 'paginate').mockResolvedValue(mockResponse);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue({} as SelectQueryBuilder<Chance>);

      const queryDto = new ListChancesQueryDto();

      const result = await service.findAll(queryDto);

      expect(result.data).toEqual([]);
      expect(result.meta.totalItems).toBe(0);
    });
  });
});
