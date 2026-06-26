/**
 * SW-BE-026 — MetricsController.getRequestSummary: pagination + sort tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { HttpMetricsService } from './http-metrics.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { MetricsSortBy, SortOrder } from './dto/metrics-query.dto';
import { PaginatedMetricsResponseDto } from './dto/metrics-summary.dto';

const MOCK_PAGINATED: PaginatedMetricsResponseDto = {
  data: [
    { method: 'GET', routeGroup: 'public', statusClass: '2xx', count: 10 },
  ],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const mockHttpMetricsService = {
  getMetricsText: jest.fn(),
  getRequestSummary: jest.fn(),
};

describe('MetricsController.getRequestSummary (SW-BE-026)', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        { provide: HttpMetricsService, useValue: mockHttpMetricsService },
        { provide: AuditTrailService, useValue: { log: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    jest.clearAllMocks();
  });

  it('delegates to HttpMetricsService.getRequestSummary()', () => {
    mockHttpMetricsService.getRequestSummary.mockReturnValue(MOCK_PAGINATED);

    const query = { page: 1, limit: 20 };
    controller.getRequestSummary(query);

    expect(mockHttpMetricsService.getRequestSummary).toHaveBeenCalledWith(query);
  });

  it('returns the paginated response from the service', () => {
    mockHttpMetricsService.getRequestSummary.mockReturnValue(MOCK_PAGINATED);

    const result = controller.getRequestSummary({});
    expect(result).toBe(MOCK_PAGINATED);
    expect(result.meta.total).toBe(1);
  });

  it('passes sort params through to the service', () => {
    mockHttpMetricsService.getRequestSummary.mockReturnValue(MOCK_PAGINATED);

    const query = {
      sortBy: MetricsSortBy.METHOD,
      sortOrder: SortOrder.ASC,
    };
    controller.getRequestSummary(query);

    expect(mockHttpMetricsService.getRequestSummary).toHaveBeenCalledWith(query);
  });

  it('existing scrape() action still works after SW-BE-026 changes', async () => {
    const prometheusText = '# HELP tycoon_http_requests_total counter\n';
    mockHttpMetricsService.getMetricsText = jest.fn().mockResolvedValue(prometheusText);

    const result = await controller.scrape();
    expect(result).toBe(prometheusText);
  });
});
