import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from './audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { StaffShiftsController } from './staff-shifts.controller';

@Module({ imports: [TypeOrmModule.forFeature([AuditLog]), AuthModule], controllers: [AuditController, StaffShiftsController], providers: [AuditService, RolesGuard], exports: [AuditService] })
export class AuditModule {}
