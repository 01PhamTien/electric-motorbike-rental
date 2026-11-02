import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { Vehicle } from '../vehicles/vehicle.entity';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { VehicleLocation } from './vehicle-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleLocation, Vehicle]), AuthModule],
  controllers: [LocationsController],
  providers: [LocationsService, RolesGuard],
})
export class LocationsModule {}
