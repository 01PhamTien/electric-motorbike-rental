import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { VehicleModel } from './vehicle-model.entity';
import { VehicleModelsController } from './vehicle-models.controller';
import { VehicleModelsService } from './vehicle-models.service';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleModel]), AuthModule],
  controllers: [VehicleModelsController],
  providers: [VehicleModelsService, RolesGuard],
  exports: [VehicleModelsService, TypeOrmModule],
})
export class VehicleModelsModule {}
