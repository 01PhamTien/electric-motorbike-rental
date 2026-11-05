import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';
import { StaffSchedule } from './staff-schedule.entity';
import { StaffSchedulesController } from './staff-schedules.controller';
import { StaffSchedulesService } from './staff-schedules.service';

@Module({
  imports: [TypeOrmModule.forFeature([StaffSchedule, User, Station]), AuthModule],
  controllers: [StaffSchedulesController],
  providers: [StaffSchedulesService, RolesGuard],
})
export class StaffSchedulesModule {}
