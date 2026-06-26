/**
 * SW-BE-026 — getRequestSummary: pagination and stable sort specs.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HttpMetricsService } from './http-metrics.service';
import { MetricsSortBy, SortOrder } from './dto/metrics-query.dto';

const mockDataSource = {
  driver: { master: { totalCount: 2, idleCount: 2, waitingCount: 0 } },
  options: { poolSize: 5 },
};

describe('HttpMetricsService.getRequestSummary (SW-BE-026)', () => {
  let service: HttpMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpMetricsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<HttpMetricsService>(HttpMetricsService);
  });

  it('returns empty data and correct meta when no requests recorded', () => {
    const result = service.getRequestSummary({});
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('accumulates request counts per label set', () => {
    service.recordRequest('GET', '/api/v1/shop', 200, 0.05);
    service.recordRequest('GET', '/api/v1/shop', 200, 0.03);
    service.recordRequest('POST', '/api/v1/shop', 201, 0.1);

    const result = service.getRequestSummary({});
    const getRow = result.data.find(
      (r) => r.method === 'GET' && r.statusClass === '2xx',
    );
    expect(getRow?.count).toBe(2);

    const postRow = result.data.find((r) => r.method === 'POST');
    expect(postRow?.count).toBe(1);
  });

  it('sorts descending by count by default', () => {
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('POST', '/api/v1/shop', 201, 0.01);

    const result = service.getRequestSummary({
      sortBy: MetricsSortBy.COUNT,
      sortOrder: SortOrder.DESC,
    });
    expect(result.data[0].count).toBeGreaterThanOrEqual(result.data[1].count);
  });

  it('sorts ascending by count when requested', () => {
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('POST', '/api/v1/shop', 201, 0.01);

    const result = service.getRequestSummary({
      sortBy: MetricsSortBy.COUNT,
      sortOrder: SortOrder.ASC,
    });
    expect(result.data[0].count).toBeLessThanOrEqual(result.data[result.data.length - 1].count);
  });

  it('sorts alphabetically by method', () => {
    service.recordRequest('POST', '/api/v1/shop', 201, 0.01);
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('DELETE', '/api/v1/shop', 204, 0.01);

    const result = service.getRequestSummary({
      sortBy: MetricsSortBy.METHOD,
      sortOrder: SortOrder.ASC,
    });
    const methods = result.data.map((r) => r.method);
    expect(methods).toEqual([...methods].sort());
  });

  it('paginates correctly', () => {
    // Record 3 distinct label sets
    service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
    service.recordRequest('POST', '/api/v1/shop', 201, 0.01);
    service.recordRequest('DELETE', '/api/v1/shop', 204, 0.01);

    const page1 = service.getRequestSummary({ page: 1, limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.total).toBe(3);
    expect(page1.meta.totalPages).toBe(2);
    expect(page1.meta.hasNextPage).toBe(true);
    expect(page1.meta.hasPreviousPage).toBe(false);

    const page2 = service.getRequestSummary({ page: 2, limit: 2 });
    expect(page2.data).toHaveLength(1);
    expect(page2.meta.hasPreviousPage).toBe(true);
    expect(page2.meta.hasNextPage).toBe(false);
  });

  it('is stably sorted: equal-count rows appear in deterministic order', () => {
    service.recordRequest('GET', '/api/v1/a', 200, 0.01);
    service.recordRequest('POST', '/api/v1/a', 200, 0.01);

    const r1 = service.getRequestSummary({ sortBy: MetricsSortBy.COUNT });
    const r2 = service.getRequestSummary({ sortBy: MetricsSortBy.COUNT });
    expect(r1.data.map((r) => r.method)).toEqual(r2.data.map((r) => r.method));
  });
});
