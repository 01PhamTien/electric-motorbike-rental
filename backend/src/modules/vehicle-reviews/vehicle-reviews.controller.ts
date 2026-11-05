import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVehicleReviewDto } from './dto';
import { VehicleReviewsService } from './vehicle-reviews.service';

@ApiTags('Vehicle reviews')
@Controller()
export class VehicleReviewsController {
  constructor(private readonly service: VehicleReviewsService) {}

  @Get('vehicles/:vehicleId/reviews')
  list(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.listForVehicle(vehicleId);
  }

  @Get('bookings/:bookingId/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  findForBooking(@CurrentUser() user: JwtUser, @Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.service.findForBooking(user, bookingId);
  }

  @Post('bookings/:bookingId/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  create(@CurrentUser() user: JwtUser, @Param('bookingId', ParseIntPipe) bookingId: number, @Body() dto: CreateVehicleReviewDto) {
    return this.service.create(user, bookingId, dto);
  }
}
