import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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
