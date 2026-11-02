import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod, PaymentPurpose } from './payment.entity';
export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentPurpose }) @IsEnum(PaymentPurpose) purpose: PaymentPurpose;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty({ example: 150000 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @ApiProperty({ example: 'thu-coc-don-12-lan-1' }) @IsString() @MaxLength(100) idempotencyKey: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) note?: string;
}
