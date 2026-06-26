import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type HealthStatusValue = 'healthy' | 'degraded' | 'unhealthy';
export type DependencyStatusValue = 'connected' | 'disconnected';

export class HealthMemoryDto {
  @ApiProperty({ example: 64 })
  heapUsedMb: number;

  @ApiProperty({ example: 128 })
  rssMb: number;
}

export class HealthLivenessResponseDto {
  @ApiProperty({ enum: ['healthy'], example: 'healthy' })
  status: HealthStatusValue;

  @ApiProperty({ example: '2026-06-26T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ description: 'Process uptime in seconds', example: 3600 })
  uptime: number;
}

export class HealthReadinessResponseDto {
  @ApiProperty({ enum: ['healthy', 'unhealthy'], example: 'healthy' })
  status: HealthStatusValue;

  @ApiProperty({ example: '2026-06-26T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  redis: DependencyStatusValue;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  database: DependencyStatusValue;
}

export class HealthAggregateResponseDto {
  @ApiProperty({ enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' })
  status: HealthStatusValue;

  @ApiProperty({ example: '2026-06-26T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ description: 'Process uptime in seconds', example: 3600 })
  uptime: number;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  redis: DependencyStatusValue;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  database: DependencyStatusValue;

  @ApiPropertyOptional({ type: HealthMemoryDto })
  memory?: HealthMemoryDto;
}

export class HealthRedisResponseDto {
  @ApiProperty({ enum: ['healthy', 'unhealthy'], example: 'healthy' })
  status: HealthStatusValue;

  @ApiProperty({ example: '2026-06-26T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  redis: DependencyStatusValue;
}
