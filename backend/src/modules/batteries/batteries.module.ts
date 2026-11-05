import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Battery } from './battery.entity';
import { BatterySwap } from './battery-swap.entity';
import { BatteriesController } from './batteries.controller';
import { BatterySwapPublicController } from './battery-swap-public.controller';
import { BatteriesService } from './batteries.service';

@Module({
  imports:[TypeOrmModule.forFeature([Battery,BatterySwap,Station,Vehicle]),AuthModule,AuditModule],
  controllers:[BatteriesController,BatterySwapPublicController],providers:[BatteriesService],
})
export class BatteriesModule {}
