# Shop & Purchases — Operational Runbook

## Overview
This runbook covers operational procedures for the Shop & Purchases module in the Tycoon backend (NestJS).

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Health Checks](#health-checks)
3. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
4. [Emergency Procedures](#emergency-procedures)
5. [Audit & Compliance](#audit--compliance)

## System Architecture

### Components
- **ShopController**: REST endpoints for shop items, purchases, and inventory.
- **ShopService**: Business logic for item CRUD, caching, and pagination.
- **PurchaseService**: Handles purchase creation, coupon validation, and idempotency.
- **InventoryService**: Manages user inventory after purchases.
- **PaginationService**: Shared pagination and stable sorting logic.

### Data Flow
```
Client -> ShopController -> ShopService -> TypeORM -> PostgreSQL
                              |
                              +-> PurchaseService -> CouponsService
                              +-> InventoryService
```

## Health Checks

### Shop Module Health
- **Dependency**: PostgreSQL (via TypeORM), Redis (cache).
- **Check**: `GET /shop/items` with `limit=1` should return within SLA.
- **Success**: HTTP 200 with paginated shop items.
- **Failure**: HTTP 5xx or timeout indicates DB/cache issue.

### Purchase Flow Health
- **Dependency**: CouponsService, InventoryService.
- **Check**: Create a test purchase with a known coupon code.
- **Success**: HTTP 201 with purchase record.
- **Failure**: HTTP 400/500 with descriptive error.

## Common Issues & Troubleshooting

### Issue 1: High DB Pool Utilization
**Symptoms**: Slow shop/purchase response times, `ECONNREFUSED` from DB.
**Resolution**:
1. Check DB pool metrics in Grafana (`tycoon_db_pool_waiting`).
2. If `waiting / poolSize >= 0.8`, consider increasing `poolSize` in `database.config.ts`.
3. Verify slow queries via TypeORM query logging.

### Issue 2: Coupon Validation Failures
**Symptoms**: Valid coupons rejected during purchase.
**Resolution**:
1. Check coupon status: `active=true`, `current_usage < max_uses`.
2. Check `shop_item_id` match in coupon rules.
3. Inspect `coupons` table for concurrent updates.

### Issue 3: Inventory Desync
**Symptoms**: User can purchase item but inventory does not update.
**Resolution**:
1. Check transaction logs in `audit_trails` for `PURCHASE_CREATED`.
2. Verify `inventory_service.addItem` was called within the transaction.
3. Manually reconcile via admin tools if needed.

### Issue 4: Cache Staleness
**Symptoms**: New shop items not visible, old prices shown.
**Resolution**:
1. Invalidate cache: `GET /shop/items` triggers `invalidateCache()`.
2. Manual flush: `RedisService.delByPattern('shop:*')`.
3. Reduce TTL in `CacheOptions` if real-time accuracy is required.

## Emergency Procedures

### Complete Shop Outage
1. Verify DB connectivity from the backend container.
2. Check Redis health.
3. If recent deployment caused this, consider rollback.
4. Notify on-call via PagerDuty/Slack.

### Purchase Duplication
1. Check `idempotency_key` in `purchases` table.
2. If duplicate exists, refund or void the second transaction.
3. Review `AuditTrailInterceptor` logs for `PURCHASE_CREATED`.

## Audit & Compliance

### Audited Actions
- `SHOP_ITEM_CREATED`
- `SHOP_ITEM_UPDATED`
- `SHOP_ITEM_DELETED`
- `PURCHASE_CREATED`
- `GIFT_SENT`

### Log Retention
- Audit logs: 90 days in `audit_trails` table.
- Application logs: 30 days in Loki/ELK.

### No Secrets in Logs
- Never log coupon codes, payment methods, or user PII.
- Ensure `logger.log` calls sanitize sensitive DTO fields.

---
**Last updated**: 2026-06-25  
**Next review**: 2026-07-25  
**Owner**: Stellar Wave Backend Team
