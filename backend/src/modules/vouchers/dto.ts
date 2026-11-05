import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, Matches } from 'class-validator';
import { VoucherDiscountType } from './voucher.entity';

export class CreateVoucherDto {
  @IsString() @MaxLength(40) @Matches(/^[A-Za-z0-9_-]+$/) code: string;
  @IsEnum(VoucherDiscountType) discountType: VoucherDiscountType;
  @Type(() => Number) @IsNumber() @Min(0.01) discountValue: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) maxDiscountAmount?: number;
  @Type(() => Number) @IsNumber() @Min(0) minRentalAmount: number;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) usageLimit?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) perCustomerLimit: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateVoucherDto {
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[A-Za-z0-9_-]+$/) code?: string;
  @IsOptional() @IsEnum(VoucherDiscountType) discountType?: VoucherDiscountType;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) discountValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) maxDiscountAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minRentalAmount?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) perCustomerLimit?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class PreviewVoucherDto {
  @IsString() @MaxLength(40) code: string;
  @Type(() => Number) @IsNumber() @Min(0.01) rentalAmount: number;
}
