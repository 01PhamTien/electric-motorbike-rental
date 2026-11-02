import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
export class HandoverDto {
  @ApiProperty({ example: 85 }) @IsInt() @Min(0) @Max(100) batteryPercent: number;
  @ApiProperty({ example: 1350.5 }) @IsNumber() @Min(0) odometerKm: number;
  @ApiProperty({ example: 'Xe nguyên vẹn, không trầy xước' }) @IsString() @MaxLength(1000) conditionNote: string;
}
