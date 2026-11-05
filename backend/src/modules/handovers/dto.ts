import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
export class HandoverDto {
  @ApiProperty({ example: 85 }) @IsInt() @Min(0) @Max(100) batteryPercent: number;
  @ApiProperty({ example: 1350.5 }) @IsNumber() @Min(0) odometerKm: number;
  @ApiProperty({ example: 'Xe nguyên vẹn, không trầy xước' }) @IsString() @MaxLength(1000) conditionNote: string;
  @ApiProperty({ required: false, example: ['BODY', 'LIGHTS', 'BRAKES', 'TIRES', 'MIRRORS', 'HORN', 'BATTERY', 'CHARGER', 'KEYS'] })
  @IsOptional() @IsArray() @ArrayMaxSize(9) @IsIn(['BODY', 'LIGHTS', 'BRAKES', 'TIRES', 'MIRRORS', 'HORN', 'BATTERY', 'CHARGER', 'KEYS'], { each: true })
  inspectionChecklist?: string[];
  @ApiProperty({ required: false, example: 'Trầy nhẹ ở yếm trái' })
  @IsOptional() @IsString() @MaxLength(1000) damageNotes?: string;
  @ApiProperty({ required: false, type: [String], example: ['https://example.com/vehicle-photo.jpg'] })
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsUrl({}, { each: true }) @MaxLength(2048, { each: true })
  photoUrls?: string[];
}
