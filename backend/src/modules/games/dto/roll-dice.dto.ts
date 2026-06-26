import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RollDiceDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: 6, description: 'First die value (1–6)' })
  @IsInt({ message: 'dice1 must be an integer' })
  @Min(1, { message: 'dice1 must be at least 1' })
  @Max(6, { message: 'dice1 cannot exceed 6' })
  dice1: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 6, description: 'Second die value (1–6)' })
  @IsInt({ message: 'dice2 must be an integer' })
  @Min(1, { message: 'dice2 must be at least 1' })
  @Max(6, { message: 'dice2 cannot exceed 6' })
  dice2: number;
}
