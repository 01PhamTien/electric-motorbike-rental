import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';

export class CreateVehicleDto {
  @IsString() code: string;
  @IsString() licensePlate: string;
  @Type(() => Number) @IsNumber() modelId: number;
  @Type(() => Number) @IsNumber() stationId: number;
  @Type(() => Number) @IsNumber() @Min(0) dailyRate: number;
  @Type(() => Number) @IsNumber() @Min(0) depositAmount: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true }) imageUrls?: string[];
}

export class UpdateVehicleDto {
  @IsOptional() @Type(() => Number) @IsNumber() stationId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) dailyRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) depositAmount?: number;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true }) imageUrls?: string[];
}
