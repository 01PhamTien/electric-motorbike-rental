import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Voucher } from './voucher.entity';
import { VoucherRedemption } from './voucher-redemption.entity';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher, VoucherRedemption]), AuthModule],
  controllers: [VouchersController],
  providers: [VouchersService, RolesGuard],
  exports: [VouchersService, TypeOrmModule],
})
export class VouchersModule {}
