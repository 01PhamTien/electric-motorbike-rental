import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertMaintenanceScheduleDto {
  @IsNumber() @Min(1) vehicleId: number;
  @IsInt() @Min(100) @Max(50000) intervalKm: number;
  @IsInt() @Min(1) @Max(730) intervalDays: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) warningKm?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) warningDays?: number;
  @IsNumber() @Min(0) lastServiceOdometerKm: number;
  @IsDateString() lastServiceAt: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
