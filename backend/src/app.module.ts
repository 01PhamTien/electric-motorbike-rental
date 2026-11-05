import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CustomerCareModule } from './modules/customer-care/customer-care.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HandoversModule } from './modules/handovers/handovers.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StationsModule } from './modules/stations/stations.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { VehicleModelsModule } from './modules/vehicle-models/vehicle-models.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: typeOrmConfig }),
    AuthModule,
    UsersModule,
    StationsModule,
    VehicleModelsModule,
    VehiclesModule,
    BookingsModule,
    HandoversModule,
    PaymentsModule,
    MaintenanceModule,
    LocationsModule,
    ReportsModule,
    CustomerCareModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}
