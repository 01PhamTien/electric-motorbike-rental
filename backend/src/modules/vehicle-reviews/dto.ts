import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateVehicleReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt() @Min(1) @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 1200 })
  @IsOptional() @IsString() @MaxLength(1200)
  comment?: string;
}
