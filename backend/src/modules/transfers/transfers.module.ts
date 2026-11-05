import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditModule } from '../audit/audit.module';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Station } from '../stations/station.entity';
import { Booking } from '../bookings/booking.entity';
import { MaintenanceRecord } from '../maintenance/maintenance.entity';
import { VehicleTransfer } from './vehicle-transfer.entity';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleTransfer, Vehicle, Station, Booking, MaintenanceRecord]), AuthModule, AuditModule],
  controllers: [TransfersController],
  providers: [TransfersService, RolesGuard],
})
export class TransfersModule {}
