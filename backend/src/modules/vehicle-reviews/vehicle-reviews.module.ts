import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Booking } from '../bookings/booking.entity';
import { VehicleReview } from './vehicle-review.entity';
import { VehicleReviewsController } from './vehicle-reviews.controller';
import { VehicleReviewsService } from './vehicle-reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleReview, Booking]), AuthModule],
  controllers: [VehicleReviewsController],
  providers: [VehicleReviewsService, RolesGuard],
})
export class VehicleReviewsModule {}
