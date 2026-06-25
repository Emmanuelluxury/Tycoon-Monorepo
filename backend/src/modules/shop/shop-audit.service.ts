import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditTrail } from '../entities/audit-trail.entity';
import { AuditAction } from '../entities/audit-trail.entity';

@Injectable()
export class ShopAuditService {
  private readonly logger = new Logger(ShopAuditService.name);

  constructor(
    @InjectRepository(AuditTrail)
    private readonly auditTrailRepository: Repository<AuditTrail>,
  ) {}

  async logShopEvent(
    action: AuditAction.SHOP_ITEM_CREATED | AuditAction.SHOP_ITEM_UPDATED | AuditAction.SHOP_ITEM_DELETED,
    userId: number,
    userEmail: string,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const audit = this.auditTrailRepository.create({
        userId,
        userEmail,
        action,
        changes,
        ipAddress,
        userAgent,
      });
      await this.auditTrailRepository.save(audit);
      this.logger.debug(`Audit logged: ${action} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to log audit trail for ${action}:`, error);
    }
  }

  async logPurchaseEvent(
    action: AuditAction.PURCHASE_CREATED | AuditAction.GIFT_SENT,
    userId: number,
    userEmail: string,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const audit = this.auditTrailRepository.create({
        userId,
        userEmail,
        action,
        changes,
        ipAddress,
        userAgent,
      });
      await this.auditTrailRepository.save(audit);
      this.logger.debug(`Audit logged: ${action} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to log audit trail for ${action}:`, error);
    }
  }
}
