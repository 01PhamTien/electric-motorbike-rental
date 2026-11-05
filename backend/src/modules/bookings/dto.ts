import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
