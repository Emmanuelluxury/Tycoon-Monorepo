import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Shop & Purchases Operational Runbook (SW-BE-012)', () => {
  const runbookPath = join(__dirname, '../../../../modules/shop/runbooks/shop-purchases-operational-runbook.md');

  it('should have operational runbook file present', () => {
    expect(existsSync(runbookPath)).toBe(true);
  });

  it('runbook should contain required sections', () => {
    const content = readFileSync(runbookPath, 'utf-8');
    expect(content).toContain('System Architecture');
    expect(content).toContain('Health Checks');
    expect(content).toContain('Common Issues & Troubleshooting');
    expect(content).toContain('Emergency Procedures');
    expect(content).toContain('Audit & Compliance');
  });

  it('runbook should reference shop and purchase components', () => {
    const content = readFileSync(runbookPath, 'utf-8');
    expect(content).toContain('ShopController');
    expect(content).toContain('PurchaseService');
    expect(content).toContain('InventoryService');
    expect(content).toContain('CouponsService');
  });

  it('runbook should document no-secrets policy', () => {
    const content = readFileSync(runbookPath, 'utf-8');
    expect(content).toContain('No Secrets in Logs');
    expect(content).toContain('coupon');
  });
});
