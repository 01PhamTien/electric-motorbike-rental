import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class HandoverDto {
  @ApiProperty({ example: 85 })
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPercent: number;

  @ApiProperty({ example: 1350.5 })
  @IsNumber()
  @Min(0)
  odometerKm: number;

  @ApiProperty({ example: 'Xe nguyên vẹn, không trầy xước' })
  @IsString()
  @MaxLength(1000)
  conditionNote: string;

  @ApiPropertyOptional({ type: [String], description: 'Danh sách URL ảnh hiện trạng xe trước/sau bàn giao' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];
}
