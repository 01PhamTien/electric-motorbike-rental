import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';

const CHARGE_CATEGORIES = ['DAMAGE', 'CLEANING', 'LATE_RETURN', 'OTHER'] as const;

export class CreateBookingChargeDto {
  @ApiProperty({ enum: CHARGE_CATEGORIES, example: 'DAMAGE' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @IsIn(CHARGE_CATEGORIES)
  category: string;

  @ApiProperty({ example: 150000 })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;

  @ApiProperty({ example: true, description: 'Khoản này được khấu trừ từ tiền cọc' })
  @IsBoolean()
  applyToDeposit: boolean;

  @ApiProperty({ example: 'Gương chiếu hậu bị vỡ, theo biên bản nhận xe' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(500)
  reason: string;
}
