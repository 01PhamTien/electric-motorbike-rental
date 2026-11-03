import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';

export class CreateVehicleDto {
  @IsString() code: string;
  @IsString() licensePlate: string;
  @Type(() => Number) @IsNumber() modelId: number;
  @Type(() => Number) @IsNumber() stationId: number;
  @Type(() => Number) @IsNumber() @Min(0) dailyRate: number;
  @Type(() => Number) @IsNumber() @Min(0) depositAmount: number;
}

export class UpdateVehicleDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) modelId?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() stationId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) dailyRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) depositAmount?: number;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
}
