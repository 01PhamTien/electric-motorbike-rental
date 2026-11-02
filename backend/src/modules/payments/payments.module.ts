import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaymentTransaction } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
@Module({ imports: [TypeOrmModule.forFeature([Booking, PaymentTransaction]), AuthModule],
  providers: [PaymentsService, RolesGuard], controllers: [PaymentsController] })
export class PaymentsModule {}
