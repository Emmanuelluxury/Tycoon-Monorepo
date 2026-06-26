import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayTaxDto {
  @ApiProperty({ example: 75, description: 'Base tax amount (positive number)', minimum: 0.01 })
  @IsNumber({}, { message: 'baseTax must be a number' })
  @IsPositive({ message: 'baseTax must be a positive number' })
  baseTax: number;
}
