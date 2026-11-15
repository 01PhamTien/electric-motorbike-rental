import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateBatteryDto {
  @ApiProperty({ example: 'VG-BAT-0001' }) @IsString() @MaxLength(80) serialNumber: string;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) stationId: number;
  @ApiPropertyOptional({ example: 2.4 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) capacityKwh?: number;
  @ApiPropertyOptional({ example: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100) healthPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class InstallBatteryDto {
  @ApiProperty({ example: 12 }) @IsInt() @Min(1) vehicleId: number;
  @ApiProperty({ example: 3 }) @IsInt() @Min(1) batteryId: number;
}
export class SwapBatteryDto {
  @ApiProperty({ example: 12 }) @IsInt() @Min(1) vehicleId: number;
  @ApiProperty({ example: 3 }) @IsInt() @Min(1) replacementBatteryId: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CreateBatteryReservationDto {
  @ApiProperty({example:1}) @IsInt() @Min(1) stationId:number;
  @ApiProperty({example:25}) @IsInt() @Min(1) bookingId:number;
}
export class RedeemBatteryReservationDto {
  @ApiProperty({example:3}) @IsInt() @Min(1) replacementBatteryId:number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?:string;
}

export class CompleteBatteryChargingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class UpdateBatteryStatusDto {
  @ApiProperty({ example: 'MAINTENANCE', enum: ['FULL','CHARGING','INSTALLED','MAINTENANCE','RETIRED'] })
  @IsString() @IsIn(['FULL','CHARGING','INSTALLED','MAINTENANCE','RETIRED']) status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class BatteryChargeHistoryQueryDto {
  @IsOptional() @IsInt() @Min(1) stationId?: number;
  @IsOptional() @IsInt() @Min(1) batteryId?: number;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsInt() @Min(1) page = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
}
