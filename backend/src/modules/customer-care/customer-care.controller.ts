import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBookingIssueDto, CreateVehicleReviewDto, UpdateBookingIssueDto } from './dto';
import { CustomerCareService } from './customer-care.service';

@ApiTags('Customer care')
@Controller()
export class CustomerCareController {
  constructor(private readonly service: CustomerCareService) {}

  @Get('vehicles/:vehicleId/reviews')
  listVehicleReviews(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.listVehicleReviews(vehicleId);
  }

  @Post('bookings/:id/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createReview(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateVehicleReviewDto) {
    return this.service.createReview(user, id, dto);
  }

  @Get('bookings/:id/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  reviewForBooking(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.reviewForBooking(user, id);
  }

  @Post('bookings/:id/issues')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createIssue(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateBookingIssueDto) {
    return this.service.createIssue(user, id, dto);
  }

  @Get('bookings/:id/issues')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  listBookingIssues(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.listBookingIssues(user, id);
  }

  @Get('issues')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  listOperations(@CurrentUser() user: JwtUser) {
    return this.service.listOperations(user);
  }

  @Patch('issues/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  updateIssue(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookingIssueDto) {
    return this.service.updateIssue(user, id, dto);
  }
}
