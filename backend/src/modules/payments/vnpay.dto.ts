import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PaymentPurpose } from './payment.entity';

export class CreateVnPayCheckoutDto {
  @ApiProperty({ enum: [PaymentPurpose.DEPOSIT, PaymentPurpose.RENT] })
  @IsEnum(PaymentPurpose)
  purpose: PaymentPurpose;

  @ApiProperty({ example: 'booking-42-deposit-attempt-1' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey: string;
}
