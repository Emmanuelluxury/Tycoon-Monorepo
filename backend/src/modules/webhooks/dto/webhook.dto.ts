import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BaseWebhookDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsObject()
  @IsNotEmptyObject()
  data: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  created: number;
}

export class StripeWebhookDto extends BaseWebhookDto {
  @Type(() => Boolean)
  @IsBoolean()
  livemode: boolean;

  @IsOptional()
  @IsString()
  api_version?: string;

  @IsOptional()
  @IsObject()
  request?: Record<string, unknown> | null;
}