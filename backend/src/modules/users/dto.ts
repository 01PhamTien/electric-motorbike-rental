import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength, MaxLength, Min } from 'class-validator';
import { UserStatus } from '../../common/enums/user-status.enum';

export class CreateStaffDto {
  @IsString() @MaxLength(120) fullName: string;
  @IsEmail() @MaxLength(160) email: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @Type(() => Number) @IsInt() @Min(1) stationId: number;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) stationId?: number;
}

export class UpdateStaffStatusDto {
  @IsEnum(UserStatus) status: UserStatus;
}

export class UpdateMyProfileDto {
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}

export class UpdateAvatarDto {
  @IsString() @MaxLength(4_500_000) avatarDataUrl: string;
}
