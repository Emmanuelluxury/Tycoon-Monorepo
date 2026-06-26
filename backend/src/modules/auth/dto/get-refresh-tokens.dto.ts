/**
 * SW-BE-002: Auth & JWT — pagination and stable sorting
 *
 * DTO for listing a user's active refresh-token sessions.
 * Uses an enum allowlist for sortBy to prevent arbitrary column names from
 * reaching the query layer (SQL-injection / schema-probing defence).
 */
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum RefreshTokenSortField {
  CREATED_AT = 'createdAt',
  LAST_USED_AT = 'lastUsedAt',
  EXPIRES_AT = 'expiresAt',
}

export class GetRefreshTokensDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: RefreshTokenSortField,
    description: 'Field to sort sessions by',
    default: RefreshTokenSortField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(RefreshTokenSortField, {
    message: `sortBy must be one of: ${Object.values(RefreshTokenSortField).join(', ')}`,
  })
  sortBy?: RefreshTokenSortField = RefreshTokenSortField.CREATED_AT;
}
