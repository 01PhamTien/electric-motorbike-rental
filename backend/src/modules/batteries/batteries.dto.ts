import { IsArray, ArrayNotEmpty, ArrayMaxSize, ArrayUnique } from 'class-validator';
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

export class CreateBatteryReservationDto {
  @ApiProperty({example:1}) @IsInt() @Min(1) stationId:number;
  @ApiProperty({example:25}) @IsInt() @Min(1) bookingId:number;
}
export class RedeemBatteryReservationDto {
  @ApiProperty({example:3}) @IsInt() @Min(1) replacementBatteryId:number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?:string;
}

export class CreateBatteryTransferDto {
  @ApiProperty({example:1}) @IsInt() @Min(1) sourceStationId:number;
  @ApiProperty({example:2}) @IsInt() @Min(1) destinationStationId:number;
  @ApiProperty({example:[11,12,13]}) @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @ArrayUnique() @IsInt({each:true}) @Min(1,{each:true}) batteryIds:number[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?:string;
}

export class CreateBatteryStocktakeDto {
  @ApiProperty({example:1}) @IsInt() @Min(1) stationId:number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?:string;
}
export class UpdateBatteryStocktakeItemDto {
  @ApiProperty({enum:['PRESENT','MISSING']}) @IsString() countStatus:'PRESENT'|'MISSING';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) observedStatus?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?:string;
}
export class AddBatteryStocktakeExtraDto {
  @ApiProperty({example:'VG-BAT-EXTRA-01'}) @IsString() @MaxLength(80) serialNumber:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) observedStatus?:string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?:string;
}
