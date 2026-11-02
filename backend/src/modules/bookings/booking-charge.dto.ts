import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class CreateBookingChargeDto {
  @ApiProperty({ example: 'DAMAGE' }) @IsString() @MaxLength(40) category: string;
  @ApiProperty({ example: 150000 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @ApiProperty({ example: true, description: 'Khoản này được khấu trừ từ tiền cọc' }) @IsBoolean() applyToDeposit: boolean;
  @ApiProperty({ example: 'Gương chiếu hậu bị vỡ, theo biên bản nhận xe' }) @IsString() @MaxLength(500) reason: string;
}
