import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ShiftHandoverDto {
  @IsString() @MinLength(3) @MaxLength(500)
  summary: string;

  @IsOptional() @IsString() @MaxLength(1000)
  pendingTasks?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true })
  checklist?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  vehicleCount?: number;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  batteryCount?: number;
}
