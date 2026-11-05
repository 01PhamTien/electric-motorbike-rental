import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateNested, ArrayMaxSize } from 'class-validator';

export class TransferInspectionChecklistDto {
  @IsBoolean() body: boolean;
  @IsBoolean() lights: boolean;
  @IsBoolean() brakes: boolean;
  @IsBoolean() tires: boolean;
  @IsBoolean() mirrors: boolean;
  @IsBoolean() horn: boolean;
  @IsBoolean() battery: boolean;
  @IsBoolean() charger: boolean;
  @IsBoolean() keys: boolean;
}

export class TransferInspectionDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100)
  batteryPercent: number;

  @Type(() => Number) @IsNumber() @Min(0)
  odometerKm: number;

  @IsString() @MaxLength(1000)
  conditionNote: string;

  @ValidateNested() @Type(() => TransferInspectionChecklistDto)
  @IsObject()
  inspectionChecklist: TransferInspectionChecklistDto;

  @IsOptional() @IsString() @MaxLength(1000)
  damageNotes?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsUrl({}, { each: true })
  photoUrls?: string[];
}

export class CreateVehicleTransferDto {
  @Type(() => Number) @IsInt() @Min(1) vehicleId: number;
  @Type(() => Number) @IsInt() @Min(1) destinationStationId: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
