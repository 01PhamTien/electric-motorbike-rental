import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { Vehicle } from './vehicle.entity';
import { VehicleModel } from '../vehicle-models/vehicle-model.entity';
import { Station } from '../stations/station.entity';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, VehicleModel, Station]), AuthModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, RolesGuard],
  exports: [VehiclesService, TypeOrmModule],
})
export class VehiclesModule {}
