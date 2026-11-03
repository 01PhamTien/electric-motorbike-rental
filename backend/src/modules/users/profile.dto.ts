import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateMyProfileDto {
  @IsString()
  @Length(2, 120)
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+(). -]{8,20}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string | null;
}
