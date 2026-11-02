import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { PaymentTransaction } from '../payments/payment.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Vehicle, PaymentTransaction])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
