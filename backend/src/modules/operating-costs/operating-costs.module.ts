import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { OperatingCost } from './operating-cost.entity';
import { OperatingCostsController } from './operating-costs.controller';
import { OperatingCostsService } from './operating-costs.service';

@Module({
  imports: [TypeOrmModule.forFeature([OperatingCost, Vehicle, Station]), AuthModule, AuditModule],
  controllers: [OperatingCostsController],
  providers: [OperatingCostsService],
})
export class OperatingCostsModule {}
