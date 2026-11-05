import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { OperatingCostCategory } from './operating-cost.entity';

export class CreateOperatingCostDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) stationId: number;
  @ApiPropertyOptional({ example: 12 }) @IsOptional() @IsInt() @Min(1) vehicleId?: number;
  @ApiProperty({ enum: OperatingCostCategory }) @IsEnum(OperatingCostCategory) category: OperatingCostCategory;
  @ApiProperty({ example: 85000 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @ApiPropertyOptional({ example: 3.5 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(100000) energyKwh?: number;
  @ApiPropertyOptional({ example: 2400 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice?: number;
  @ApiProperty({ example: '2026-11-05T08:30:00+07:00' }) @IsDateString() occurredAt: string;
  @ApiPropertyOptional({ example: 'Sạc pin sau khi khách trả xe' }) @IsOptional() @IsString() @MaxLength(500) note?: string;
}
