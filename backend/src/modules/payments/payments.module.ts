import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaymentTransaction } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { VnPayPaymentAttempt } from './vnpay-payment-attempt.entity';
import { VnPayService } from './vnpay.service';
import { VnPayController } from './vnpay.controller';
@Module({ imports: [TypeOrmModule.forFeature([Booking, PaymentTransaction, VnPayPaymentAttempt]), AuthModule],
  providers: [PaymentsService, VnPayService, RolesGuard], controllers: [PaymentsController, VnPayController] })
export class PaymentsModule {}
