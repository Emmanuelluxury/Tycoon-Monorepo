import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum MetricsSortBy {
  METHOD = 'method',
  ROUTE_GROUP = 'routeGroup',
  STATUS_CLASS = 'statusClass',
  COUNT = 'count',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class MetricsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: MetricsSortBy, description: 'Field to sort by', default: MetricsSortBy.COUNT })
  @IsOptional()
  @IsEnum(MetricsSortBy)
  sortBy?: MetricsSortBy = MetricsSortBy.COUNT;

  @ApiPropertyOptional({ enum: SortOrder, description: 'Sort direction', default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
