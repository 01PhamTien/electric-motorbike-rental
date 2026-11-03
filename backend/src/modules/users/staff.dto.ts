import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { UserStatus } from '../../common/enums/user-status.enum';

export class CreateStaffDto {
  @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @IsEmail() @MaxLength(160) email: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @Type(() => Number) @IsInt() @Min(1) stationId: number;
}
export class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) stationId?: number;
}
export class UpdateStaffStatusDto {
  @IsEnum(UserStatus) status: UserStatus;
}
