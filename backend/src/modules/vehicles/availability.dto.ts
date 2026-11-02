import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class VehicleAvailabilityQueryDto {
  @IsDateString()
  pickupAt: string;

  @IsDateString()
  returnAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  modelId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDailyRate?: number;
}
