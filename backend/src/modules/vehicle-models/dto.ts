import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class CreateVehicleModelDto {
  @IsString()
  brand: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional() @IsString() @MaxLength(500)
  @Matches(/^(\/images\/vehicle-models\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g)|https:\/\/[^\s]+)$/i, { message: 'Đường dẫn ảnh phải là /images/vehicle-models/... hoặc HTTPS' })
  imageUrl?: string | null;
}

export class UpdateVehicleModelDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  specifications?: string;
  @IsOptional() @IsString() @MaxLength(500)
  @Matches(/^(\/api\/vehicle-models\/images\/[a-f0-9-]+\.(?:png|jpe?g|webp)|\/images\/vehicle-models\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g)|https:\/\/[^\s]+)$/i, { message: 'Đường dẫn ảnh không hợp lệ' })
  imageUrl?: string | null;

}
