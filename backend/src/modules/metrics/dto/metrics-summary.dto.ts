import { ApiProperty } from '@nestjs/swagger';

export class MetricsSummaryItemDto {
  @ApiProperty({ example: 'GET' })
  method: string;

  @ApiProperty({ example: 'public' })
  routeGroup: string;

  @ApiProperty({ example: '2xx' })
  statusClass: string;

  @ApiProperty({ example: 42 })
  count: number;
}

export class PaginatedMetricsMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 6 })
  total: number;

  @ApiProperty({ example: 1 })
  totalPages: number;

  @ApiProperty({ example: false })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}

export class PaginatedMetricsResponseDto {
  @ApiProperty({ type: [MetricsSummaryItemDto] })
  data: MetricsSummaryItemDto[];

  @ApiProperty({ type: PaginatedMetricsMeta })
  meta: PaginatedMetricsMeta;
}
