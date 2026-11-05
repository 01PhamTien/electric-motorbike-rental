import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { PaymentTransaction } from '../payments/payment.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { MaintenanceRecord } from '../maintenance/maintenance.entity';
import { OperatingCost } from '../operating-costs/operating-cost.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Vehicle, PaymentTransaction, MaintenanceRecord, OperatingCost])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
