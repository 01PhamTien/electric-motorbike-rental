import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Booking } from '../bookings/booking.entity';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaymentTransaction } from './payment.entity';
import { SePayPaymentAttempt } from './sepay-payment-attempt.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SePayService } from './sepay.service';
import { SePayController } from './sepay.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, PaymentTransaction, SePayPaymentAttempt]), AuthModule, ConfigModule],
  providers: [PaymentsService, SePayService, RolesGuard],
  controllers: [PaymentsController, SePayController],
})
export class PaymentsModule {}
