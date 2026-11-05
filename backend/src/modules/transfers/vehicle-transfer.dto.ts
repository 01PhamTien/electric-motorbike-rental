import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateVehicleTransferDto {
  @Type(() => Number) @IsInt() @Min(1) vehicleId: number;
  @Type(() => Number) @IsInt() @Min(1) destinationStationId: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
