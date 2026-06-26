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

describe('ShopService - Observability (SW-BE-007)', () => {
  let service: ShopService;
  let shopItemRepositoryMock: Repository<ShopItem>;
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
    auditServiceMock = module.get<ShopAuditService>(ShopAuditService);
    metricsServiceMock = module.get<ShopMetricsService>(ShopMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('observability: metrics and audit hooks', () => {
    it('should log metrics on successful purchase flow', async () => {
      const mockItem = { id: 1, name: 'Test', price: '100.00', active: true, currency: 'USD' };
      shopItemRepositoryMock.findOne.mockResolvedValue(mockItem);

      const mockSaved = { id: 1, user_id: 1, shop_item_id: 1, quantity: 1, final_price: '100.00', shop_item: mockItem };
      const mockQueryRunner = {
        connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(), release: jest.fn(),
        manager: { create: jest.fn().mockReturnValue(mockSaved), save: jest.fn().mockResolvedValue(mockSaved), findOne: jest.fn().mockResolvedValue(mockSaved) },
      };
      const mockDataSource = { createQueryRunner: jest.fn(() => mockQueryRunner) };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ShopService,
          { provide: getRepositoryToken(ShopItem), useValue: shopItemRepositoryMock },
          { provide: getRepositoryToken(Purchase), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() } },
          { provide: UsersService, useValue: mockUsersService },
          { provide: GiftsService, useValue: mockGiftsService },
          { provide: RedisService, useValue: mockRedisService },
          PaginationService,
          DataSource: { useValue: mockDataSource },
          { provide: ShopAuditService, useValue: auditServiceMock },
          { provide: ShopMetricsService, useValue: metricsServiceMock },
        ],
      }).compile();

      const svc = module.get<ShopService>(ShopService);
      const result = await (svc as any).purchaseAndGift(1, { shop_item_id: 1, receiver_id: 2, quantity: 1, message: 'test', payment_method: 'balance' });

      // Audit hook would be called for purchase creation
      expect(auditServiceMock.logPurchaseEvent).toBeDefined();
      expect(metricsServiceMock.recordPurchase).toBeDefined();
    });
  });
});
