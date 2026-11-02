import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BookingStatusHistory } from './booking-status-history.entity';
import { Booking } from './booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingStatusHistory, Vehicle]), AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService, RolesGuard],
  exports: [BookingsService, TypeOrmModule],
})
export class BookingsModule {}
