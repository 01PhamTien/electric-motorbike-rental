import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { AuditModule } from '../audit/audit.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceRecord } from './maintenance.entity';
import { MaintenanceSchedule } from './maintenance-schedule.entity';
import { HandoverRecord } from '../handovers/handover.entity';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceRecord, MaintenanceSchedule, Vehicle, HandoverRecord]), AuditModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
