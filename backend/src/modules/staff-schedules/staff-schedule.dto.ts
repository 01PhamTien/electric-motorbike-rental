import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateStaffScheduleDto {
  @IsInt() @Min(1) staffId: number;
  @IsInt() @Min(1) stationId: number;
  @IsISO8601() startAt: string;
  @IsISO8601() endAt: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateStaffScheduleDto {
  @IsOptional() @IsInt() @Min(1) staffId?: number;
  @IsOptional() @IsInt() @Min(1) stationId?: number;
  @IsOptional() @IsISO8601() startAt?: string;
  @IsOptional() @IsISO8601() endAt?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsIn(['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED']) status?: 'PLANNED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';
}
