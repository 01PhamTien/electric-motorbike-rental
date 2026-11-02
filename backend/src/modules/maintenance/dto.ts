import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { MaintenanceStatus } from './maintenance.entity';

export class CreateMaintenanceDto {
  @IsNumber() @Min(1) vehicleId: number;
  @IsDateString() scheduledAt: string;
  @IsString() @Length(2, 160) reason: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
}

export class UpdateMaintenanceDto {
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() @Length(2, 160) reason?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
}
