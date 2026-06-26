import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayRentDto {
  @ApiProperty({ example: 2, description: 'ID of the player receiving rent', minimum: 1 })
  @IsInt({ message: 'payeeId must be an integer' })
  @Min(1, { message: 'payeeId must be at least 1' })
  payeeId: number;

  @ApiProperty({ example: 50, description: 'Base rent amount (positive number)', minimum: 0.01 })
  @IsNumber({}, { message: 'baseRent must be a number' })
  @IsPositive({ message: 'baseRent must be a positive number' })
  baseRent: number;
}
