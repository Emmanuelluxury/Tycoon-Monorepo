import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BuyPropertyDto {
  @ApiProperty({ example: 200, description: 'Purchase cost of the property (positive number)', minimum: 0.01 })
  @IsNumber({}, { message: 'propertyCost must be a number' })
  @IsPositive({ message: 'propertyCost must be a positive number' })
  propertyCost: number;

  @ApiProperty({ example: 5, description: 'Property entity ID', minimum: 1 })
  @IsInt({ message: 'propertyId must be an integer' })
  @Min(1, { message: 'propertyId must be at least 1' })
  propertyId: number;
}
