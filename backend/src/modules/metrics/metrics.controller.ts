import { Controller, Get, Header, Query, UseInterceptors, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HttpMetricsService } from './http-metrics.service';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';
import { AuditLog } from '../audit-trail/audit-log.decorator';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { PaginatedMetricsResponseDto } from './dto/metrics-summary.dto';

@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly httpMetrics: HttpMetricsService) { }

  @Get()
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.METRICS_SCRAPED)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.httpMetrics.getMetricsText();
  }

  /**
   * GET /metrics/requests
   *
   * Returns a paginated, stably-sorted summary of HTTP request counts
   * grouped by method × route_group × status_class, accumulated since
   * process start.  Useful for dashboards / quick sanity checks without
   * needing a Prometheus scraper.
   *
   * [SW-BE-026]
   */
  @Get('requests')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getRequestSummary(@Query() query: MetricsQueryDto): PaginatedMetricsResponseDto {
    return this.httpMetrics.getRequestSummary(query);
  }
}
