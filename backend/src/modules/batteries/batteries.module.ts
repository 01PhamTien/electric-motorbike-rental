import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Battery } from './battery.entity';
import { BatterySwap } from './battery-swap.entity';
import { BatteryReservation } from './battery-reservation.entity';
import { BatteryTransfer, BatteryTransferItem } from './battery-transfer.entity';
import { BatteryTransfersService } from './battery-transfers.service';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';
import { BatteriesController } from './batteries.controller';
import { BatterySwapPublicController } from './battery-swap-public.controller';
import { BatteriesService } from './batteries.service';

@Module({
  imports:[TypeOrmModule.forFeature([Battery,BatterySwap,BatteryReservation,BatteryTransfer,BatteryTransferItem,Station,Vehicle,Booking,User]),AuthModule,AuditModule],
  controllers:[BatteriesController,BatterySwapPublicController],providers:[BatteriesService,BatteryTransfersService],
})
export class BatteriesModule {}
