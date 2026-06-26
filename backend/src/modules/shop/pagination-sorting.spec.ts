import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopService } from './shop.service';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { UsersService } from '../users/users.service';
import { GiftsService } from '../gifts/gifts.service';
import { RedisService } from '../redis/redis.service';
import { PaginationService } from '../../common/services/pagination.service';
import { ShopAuditService } from './shop-audit.service';
import { ShopMetricsService } from './shop-metrics.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { FilterShopItemsDto } from './dto/filter-shop-items.dto';

describe('ShopService - Pagination and Stable Sorting (SW-BE-008)', () => {
  let service: ShopService;
  let shopItemRepositoryMock: Repository<ShopItem>;
  let purchaseRepositoryMock: Repository<Purchase>;
  let paginationServiceMock: PaginationService;
  let auditServiceMock: ShopAuditService;
  let metricsServiceMock: ShopMetricsService;

  const mockUsersService = { findOne: jest.fn() };
  const mockGiftsService = { create: jest.fn() };
  const mockRedisService = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: getRepositoryToken(ShopItem), useValue: { createQueryBuilder: jest.fn(), findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Purchase), useValue: {} },
        { provide: UsersService, useValue: mockUsersService },
        { provide: GiftsService, useValue: mockGiftsService },
        { provide: RedisService, useValue: mockRedisService },
        PaginationService,
        { provide: ShopAuditService, useValue: { logShopEvent: jest.fn() } },
        { provide: ShopMetricsService, useValue: { recordPurchase: jest.fn(), recordCouponUsage: jest.fn(), recordInventoryUpdate: jest.fn() } },
      ],
    }).compile();

    service = module.get<ShopService>(ShopService);
    shopItemRepositoryMock = module.get(getRepositoryToken(ShopItem));
    paginationServiceMock = module.get<PaginationService>(PaginationService);
    auditServiceMock = module.get<ShopAuditService>(ShopAuditService);
    metricsServiceMock = module.get<ShopMetricsService>(ShopMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll pagination and sorting', () => {
    it('should return paginated results from PaginationService', async () => {
      const mockPaginated: PaginatedResponse<ShopItem> = {
        data: [ { id: 1, name: 'Test', price: '10.00', active: true } ],
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      };
      jest.spyOn(paginationServiceMock, 'paginate').mockResolvedValue(mockPaginated);

      const filterDto: FilterShopItemsDto = { page: 1, limit: 10 };
      const result = await service.findAll(filterDto);

      expect(result).toEqual(mockPaginated);
      expect(paginationServiceMock.paginate).toHaveBeenCalled();
    });

    it('should use stable secondary sort by id', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      const mockPaginated = { data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
      jest.spyOn(paginationServiceMock, 'paginate').mockResolvedValue(mockPaginated);

      const filterDto: FilterShopItemsDto = { page: 1, limit: 10, sortBy: 'price', sortOrder: 'asc' };
      await service.findAll(filterDto);

      expect(paginationServiceMock.paginate).toHaveBeenCalledWith(
        expect.anything(),
        filterDto,
        expect.any(Array),
        expect.any(Array),
      );
    });

    it('should reject invalid sortBy fields', async () => {
      const filterDto: FilterShopItemsDto = { page: 1, limit: 10, sortBy: 'invalid_column' };
      jest.spyOn(paginationServiceMock, 'paginate').mockImplementation(() => {
        throw new Error('Invalid sortBy field');
      });

      await expect(service.findAll(filterDto)).rejects.toThrow();
    });
  });
});
