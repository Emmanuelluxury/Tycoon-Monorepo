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
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';

describe('ShopService - Audit Trail Hooks (SW-BE-011)', () => {
  let service: ShopService;
  let shopItemRepositoryMock: Repository<ShopItem>;
  let auditServiceMock: ShopAuditService;
  let metricsServiceMock: ShopMetricsService;

  const mockUsersService = { findOne: jest.fn() };
  const mockGiftsService = { create: jest.fn() };
  const mockRedisService = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() };
  const mockQueryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(),
    manager: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
  };
  const mockDataSource = { createQueryRunner: jest.fn(() => mockQueryRunner) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: getRepositoryToken(ShopItem), useValue: { createQueryBuilder: jest.fn(), findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Purchase), useValue: {} },
        { provide: UsersService, useValue: mockUsersService },
        { provide: GiftsService, useValue: mockGiftsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: DataSource, useValue: mockDataSource },
        PaginationService,
        { provide: ShopAuditService, useValue: { logShopEvent: jest.fn(), logPurchaseEvent: jest.fn() } },
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

  describe('audit trail hooks', () => {
    it('should call audit log on shop item creation', async () => {
      const mockItem = { id: 1, name: 'Golden Dice', price: '9.99', active: true };
      shopItemRepositoryMock.create.mockReturnValue(mockItem);
      shopItemRepositoryMock.save.mockResolvedValue(mockItem);

      const result = await service.create({ name: 'Golden Dice', price: 9.99, type: 'skin', active: true });

      expect(result).toEqual(mockItem);
      expect(auditServiceMock.logShopEvent).toHaveBeenCalledWith(
        AuditAction.SHOP_ITEM_CREATED,
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({ name: 'Golden Dice' }),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should call audit log on shop item update', async () => {
      const existing = { id: 1, name: 'Old Name', price: '10.00', active: true };
      shopItemRepositoryMock.findOne.mockResolvedValue(existing);
      shopItemRepositoryMock.save.mockResolvedValue({ ...existing, name: 'New Name' });

      const result = await service.update(1, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(auditServiceMock.logShopEvent).toHaveBeenCalledWith(
        AuditAction.SHOP_ITEM_UPDATED,
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({ name: 'New Name' }),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should call audit log on shop item deactivation', async () => {
      const existing = { id: 1, name: 'Item', price: '10.00', active: true };
      shopItemRepositoryMock.findOne.mockResolvedValue(existing);
      shopItemRepositoryMock.save.mockResolvedValue({ ...existing, active: false });

      const result = await service.remove(1);

      expect(result.active).toBe(false);
      expect(auditServiceMock.logShopEvent).toHaveBeenCalledWith(
        AuditAction.SHOP_ITEM_DELETED,
        expect.any(Number),
        expect.any(String),
        expect.objectContaining({ active: false }),
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
