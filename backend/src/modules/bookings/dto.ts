import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @Type(() => Number)
  @IsNumber()
  vehicleId: number;

  @IsDateString()
  pickupAt: string;

  @IsDateString()
  returnAt: string;

  @IsOptional() @IsString() @MaxLength(40)
  voucherCode?: string;

  @IsOptional() @IsIn(['CASH', 'TRANSFER', 'SEPAY'])
  preferredPaymentMethod?: 'CASH' | 'TRANSFER' | 'SEPAY';
}

export class UpdateBookingDto {
  @IsOptional() @IsDateString()
  pickupAt?: string;

  @IsOptional() @IsDateString()
  returnAt?: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
