import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { RedisService } from '../modules/redis/redis.service';
import { AuditTrailInterceptor } from '../modules/audit-trail/audit-trail.interceptor';
import { AuditLog } from '../modules/audit-trail/audit-log.decorator';
import { AuditAction } from '../modules/audit-trail/entities/audit-trail.entity';
import {
  HealthAggregateResponseDto,
  HealthLivenessResponseDto,
  HealthReadinessResponseDto,
  HealthRedisResponseDto,
} from './dto/health-response.dto';

/**
 * Health endpoints — SW-BE-025 / SW-BE-028
 *
 * GET /health/live    — liveness probe (process is up)
 * GET /health/ready   — readiness probe (DB + Redis reachable); 503 when unhealthy
 * GET /health/redis   — Redis-only check (backward-compat); 503 when disconnected
 * GET /health         — full aggregate check; 503 when all deps down
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Liveness: the process is alive and the event loop is responsive. */
  @Get('live')
  liveness(): HealthLivenessResponseDto {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness: all critical dependencies are reachable.
   * Returns HTTP 503 when any dependency is unavailable so that Kubernetes
   * stops routing traffic to the pod until it recovers.
   */
  @Get('ready')
  async readiness(): Promise<HealthReadinessResponseDto> {
    const [redisOk, dbOk] = await Promise.all([
      this.checkRedisOk(),
      this.checkDbOk(),
    ]);

    const payload: HealthReadinessResponseDto = {
      status: redisOk && dbOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: redisOk ? 'connected' : 'disconnected',
      database: dbOk ? 'connected' : 'disconnected',
    };

    if (payload.status !== 'healthy') {
      throw new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return payload;
  }

  /** Full aggregate health check (all dependencies). */
  @Get()
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.HEALTH_CHECK_ACCESSED)
  async aggregate(): Promise<HealthAggregateResponseDto> {
    const [redisOk, dbOk] = await Promise.all([
      this.checkRedisOk(),
      this.checkDbOk(),
    ]);

    const allOk = redisOk && dbOk;
    const anyOk = redisOk || dbOk;
    const status = allOk ? 'healthy' : anyOk ? 'degraded' : 'unhealthy';

    const payload: HealthAggregateResponseDto = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: redisOk ? 'connected' : 'disconnected',
      database: dbOk ? 'connected' : 'disconnected',
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };

    // 503 only when every dependency is down; degraded still serves 200
    // so monitoring dashboards can distinguish partial vs total failure.
    if (status === 'unhealthy') {
      throw new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return payload;
  }

  /** Redis-only check — kept for backward compatibility. */
  @Get('redis')
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.HEALTH_CHECK_ACCESSED)
  async checkRedis(): Promise<HealthRedisResponseDto> {
    const ok = await this.checkRedisOk();

    const payload: HealthRedisResponseDto = {
      status: ok ? 'healthy' : 'unhealthy',
      redis: ok ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };

    if (!ok) {
      throw new HttpException(payload, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return payload;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async checkRedisOk(): Promise<boolean> {
    try {
      await this.redisService.set('health-check', 'ok', 10);
      const result = await this.redisService.get('health-check');
      return result === 'ok';
    } catch {
      return false;
    }
  }

  private async checkDbOk(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
