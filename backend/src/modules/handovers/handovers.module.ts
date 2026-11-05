import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatusHistory } from '../bookings/booking-status-history.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HandoverRecord } from './handover.entity';
import { HandoversService } from './handovers.service';
import { HandoversController } from './handovers.controller';
@Module({ imports: [TypeOrmModule.forFeature([Booking, BookingStatusHistory, HandoverRecord]), AuthModule, NotificationsModule, AuditModule],
  providers: [HandoversService, RolesGuard], controllers: [HandoversController] })
export class HandoversModule {}
