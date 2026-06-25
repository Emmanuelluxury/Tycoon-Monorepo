/**
 * SW-BE-009: Shop & purchases — idempotency and replay tests
 *
 * Verifies that the PurchaseService correctly handles:
 *  - Idempotency key uniqueness: same key → same purchase returned (replay)
 *  - No second charge on replay
 *  - Different keys → distinct purchases
 *  - Missing idempotency key → new purchase each time
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { Purchase } from './entities/purchase.entity';
import { ShopItem } from './entities/shop-item.entity';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from './inventory.service';
import { ShopItemType } from './enums/shop-item-type.enum';

const IDEMPOTENCY_KEY = 'idem-key-abc123';

const mockShopItem: Partial<ShopItem> = {
  id: 1,
  name: 'Speed Boost',
  price: '50.00',
  currency: 'USD',
  active: true,
  type: ShopItemType.SKIN,
};

const mockCompletedPurchase = {
  id: 42,
  user_id: 7,
  shop_item_id: 1,
  quantity: 1,
  idempotency_key: IDEMPOTENCY_KEY,
  original_price: '50.00',
  discount_amount: '0.00',
  final_price: '50.00',
  currency: 'USD',
  status: 'completed',
  shop_item: mockShopItem,
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: { save: jest.fn() },
};

const mockPurchaseRepository = {
  create: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
};

const mockShopItemRepository = {
  findOne: jest.fn(),
};

const mockCouponsService: Partial<CouponsService> = {
  validateCoupon: jest.fn(),
  findByCode: jest.fn(),
  calculateDiscount: jest.fn(),
  incrementUsage: jest.fn(),
  logCouponUsage: jest.fn(),
};

const mockInventoryService: Partial<InventoryService> = {
  addItem: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn(() => mockQueryRunner),
};

describe('PurchaseService — idempotency & replay (SW-BE-009)', () => {
  let service: PurchaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
        { provide: getRepositoryToken(Purchase), useValue: mockPurchaseRepository },
        { provide: getRepositoryToken(ShopItem), useValue: mockShopItemRepository },
        { provide: CouponsService, useValue: mockCouponsService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Replay: idempotency key already exists ──────────────────────────────────

  it('returns the cached purchase on replay without re-charging', async () => {
    // First findOne call: idempotency lookup → hit
    mockPurchaseRepository.findOne.mockResolvedValueOnce(mockCompletedPurchase);

    const result = await service.createPurchase(7, {
      shop_item_id: 1,
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(result).toEqual(mockCompletedPurchase);
    // Should NOT look up the shop item or create a transaction
    expect(mockShopItemRepository.findOne).not.toHaveBeenCalled();
    expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('does not call inventory or coupon service on replay', async () => {
    mockPurchaseRepository.findOne.mockResolvedValueOnce(mockCompletedPurchase);

    await service.createPurchase(7, {
      shop_item_id: 1,
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(mockInventoryService.addItem).not.toHaveBeenCalled();
    expect(mockCouponsService.incrementUsage).not.toHaveBeenCalled();
  });

  it('returns the exact same purchase object on multiple replays', async () => {
    mockPurchaseRepository.findOne
      .mockResolvedValueOnce(mockCompletedPurchase)
      .mockResolvedValueOnce(mockCompletedPurchase);

    const r1 = await service.createPurchase(7, { shop_item_id: 1, idempotency_key: IDEMPOTENCY_KEY });
    const r2 = await service.createPurchase(7, { shop_item_id: 1, idempotency_key: IDEMPOTENCY_KEY });

    expect(r1.id).toBe(r2.id);
    expect(r1.final_price).toBe(r2.final_price);
  });

  // ── First-time purchase (no existing key) ────────────────────────────────────

  it('creates a new purchase when idempotency key has not been seen before', async () => {
    const newPurchase = { ...mockCompletedPurchase, id: 99 };

    // Idempotency lookup → miss; second findOne → load relations
    mockPurchaseRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(newPurchase);

    mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
    mockPurchaseRepository.create.mockReturnValue(newPurchase);
    mockQueryRunner.manager.save.mockResolvedValue(newPurchase);

    const result = await service.createPurchase(7, {
      shop_item_id: 1,
      idempotency_key: 'brand-new-key',
    });

    expect(result.id).toBe(99);
    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockInventoryService.addItem).toHaveBeenCalledWith(7, 1, 1);
  });

  // ── No idempotency key → always creates ─────────────────────────────────────

  it('proceeds to create a fresh purchase when no idempotency key is supplied', async () => {
    const newPurchase = { ...mockCompletedPurchase, id: 100, idempotency_key: undefined };

    mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
    mockPurchaseRepository.create.mockReturnValue(newPurchase);
    mockQueryRunner.manager.save.mockResolvedValue(newPurchase);
    mockPurchaseRepository.findOne.mockResolvedValueOnce(newPurchase);

    const result = await service.createPurchase(7, { shop_item_id: 1 });

    // No idempotency lookup should happen
    expect(mockPurchaseRepository.findOne).toHaveBeenCalledTimes(1); // only post-save load
    expect(result.id).toBe(100);
  });

  // ── Different user, same key → different scope ───────────────────────────────

  it('does not replay for a different user even if the key string matches', async () => {
    const otherUserPurchase = { ...mockCompletedPurchase, id: 77, user_id: 8 };

    // user_id=8's idempotency lookup → miss (different user scope)
    mockPurchaseRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(otherUserPurchase);

    mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
    mockPurchaseRepository.create.mockReturnValue(otherUserPurchase);
    mockQueryRunner.manager.save.mockResolvedValue(otherUserPurchase);

    const result = await service.createPurchase(8, {
      shop_item_id: 1,
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(result.user_id).toBe(8);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  // ── Error paths ──────────────────────────────────────────────────────────────

  it('throws NotFoundException when item does not exist (first-time purchase)', async () => {
    mockPurchaseRepository.findOne.mockResolvedValueOnce(null); // idempotency miss
    mockShopItemRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createPurchase(7, { shop_item_id: 999, idempotency_key: 'new-key' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when item is inactive (first-time purchase)', async () => {
    mockPurchaseRepository.findOne.mockResolvedValueOnce(null); // idempotency miss
    mockShopItemRepository.findOne.mockResolvedValue({ ...mockShopItem, active: false });

    await expect(
      service.createPurchase(7, { shop_item_id: 1, idempotency_key: 'new-key-2' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rolls back and does not store purchase on transaction failure', async () => {
    mockPurchaseRepository.findOne.mockResolvedValueOnce(null); // idempotency miss
    mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
    mockPurchaseRepository.create.mockReturnValue({});
    mockQueryRunner.manager.save.mockRejectedValue(new Error('DB constraint'));

    await expect(
      service.createPurchase(7, { shop_item_id: 1, idempotency_key: 'fail-key' }),
    ).rejects.toThrow('DB constraint');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
    // Inventory must NOT have been updated
    expect(mockInventoryService.addItem).not.toHaveBeenCalled();
  });
});
