import { IsOptional, IsString } from 'class-validator';

export class CreateVehicleModelDto {
  @IsString()
  brand: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  specifications?: string;
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
}
