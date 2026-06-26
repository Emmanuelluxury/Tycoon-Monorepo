import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Whitelisted fields that uploads can be sorted by. */
export const UPLOADS_SORT_WHITELIST = [
  'id',
  'originalName',
  'mimeType',
  'size',
  'createdAt',
] as const;

export type UploadsSortField = (typeof UPLOADS_SORT_WHITELIST)[number];

/**
 * Uploads-specific pagination DTO – extends the common PaginationDto and
 * restricts sortBy to the whitelisted Upload entity fields to prevent
 * arbitrary column injection.
 */
export class UploadsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Field to sort uploads by',
    enum: UPLOADS_SORT_WHITELIST,
    default: 'id',
  })
  @IsOptional()
  @IsIn(UPLOADS_SORT_WHITELIST, {
    message: `sortBy must be one of: ${UPLOADS_SORT_WHITELIST.join(', ')}`,
  })
  sortBy?: UploadsSortField = 'id';
}
