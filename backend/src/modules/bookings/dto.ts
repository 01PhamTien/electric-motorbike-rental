import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @Type(() => Number)
  @IsNumber()
  vehicleId: number;

  @IsDateString()
  pickupAt: string;

  @IsDateString()
  returnAt: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
