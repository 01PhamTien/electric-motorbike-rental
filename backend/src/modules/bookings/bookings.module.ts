import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BookingStatusHistory } from './booking-status-history.entity';
import { Booking } from './booking.entity';
import { BookingExpiryService } from './booking-expiry.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingStatusHistory, Vehicle]), AuthModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingExpiryService, RolesGuard],
  exports: [BookingsService, TypeOrmModule],
})
export class BookingsModule {}
