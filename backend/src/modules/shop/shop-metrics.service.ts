import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class ShopMetricsService {
  private readonly registry = new Registry();
  private readonly logger = new Logger(ShopMetricsService.name);

  private readonly purchaseDuration: Histogram;
  private readonly purchaseTotal: Counter;
  private readonly purchaseAmount: Histogram;
  private readonly couponUsage: Counter;
  private readonly inventoryUpdateDuration: Histogram;

  constructor() {
    this.purchaseDuration = new Histogram({
      name: 'tycoon_shop_purchase_duration_seconds',
      help: 'Duration of purchase creation in seconds',
      labelNames: ['status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.purchaseTotal = new Counter({
      name: 'tycoon_shop_purchase_total',
      help: 'Total number of purchases attempted',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.purchaseAmount = new Histogram({
      name: 'tycoon_shop_purchase_amount_usdc',
      help: 'Purchase final price in USDC (stroops converted)',
      labelNames: ['status'],
      buckets: [1, 5, 10, 50, 100, 500, 1000],
      registers: [this.registry],
    });

    this.couponUsage = new Counter({
      name: 'tycoon_shop_coupon_usage_total',
      help: 'Total number of coupon usages in purchases',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.inventoryUpdateDuration = new Histogram({
      name: 'tycoon_shop_inventory_update_duration_seconds',
      help: 'Duration of inventory item addition in seconds',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });
  }

  recordPurchase(status: 'success' | 'failure', durationSeconds: number, amountUsdc: number): void {
    this.purchaseTotal.inc({ status });
    this.purchaseDuration.observe({ status }, durationSeconds);
    this.purchaseAmount.observe({ status }, amountUsdc);
    this.logger.debug(`Purchase metric recorded: status=${status}, duration=${durationSeconds}s, amount=${amountUsdc}`);
  }

  recordCouponUsage(status: 'success' | 'failure'): void {
    this.couponUsage.inc({ status });
    this.logger.debug(`Coupon usage metric recorded: status=${status}`);
  }

  recordInventoryUpdate(durationSeconds: number): void {
    this.inventoryUpdateDuration.observe(durationSeconds);
    this.logger.debug(`Inventory update metric recorded: duration=${durationSeconds}s`);
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
