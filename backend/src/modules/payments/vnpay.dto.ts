import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PaymentPurpose } from './payment.entity';

export class CreateVnPayPaymentDto {
  @ApiProperty({ enum: [PaymentPurpose.DEPOSIT, PaymentPurpose.RENT] })
  @IsEnum(PaymentPurpose)
  purpose: PaymentPurpose;

  @ApiProperty({ example: 'voltgo-deposit-booking-42-attempt-1' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey: string;
}
