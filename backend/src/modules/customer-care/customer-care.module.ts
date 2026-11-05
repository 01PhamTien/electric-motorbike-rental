import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { BookingIssue } from './booking-issue.entity';
import { CustomerCareController } from './customer-care.controller';
import { CustomerCareService } from './customer-care.service';
import { VehicleReview } from './vehicle-review.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleReview, BookingIssue]), AuthModule],
  controllers: [CustomerCareController],
  providers: [CustomerCareService, RolesGuard],
})
export class CustomerCareModule {}
