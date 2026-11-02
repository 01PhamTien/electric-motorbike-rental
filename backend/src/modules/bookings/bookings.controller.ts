import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto, CreateBookingDto } from './dto';
import { CreateBookingChargeDto } from './booking-charge.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBookingDto) { return this.service.create(user, dto); }

  @Get('my')
  @Roles(Role.CUSTOMER)
  my(@CurrentUser() user: JwtUser) { return this.service.myBookings(user); }

  @Get('operations')
  @Roles(Role.ADMIN, Role.STAFF)
  operations(@CurrentUser() user: JwtUser) { return this.service.operationsQueue(user); }

  @Post(':id/charges')
  @Roles(Role.ADMIN, Role.STAFF)
  addCharge(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateBookingChargeDto) {
    return this.service.addCharge(user, id, dto);
  }

  @Get(':id/history')
  statusHistory(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.statusHistory(user, id);
  }

  @Get(':id/charges')
  listCharges(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.listCharges(user, id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) { return this.service.findOne(user, id); }

  @Patch(':id/confirm')
  @Roles(Role.ADMIN, Role.STAFF)
  confirm(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) { return this.service.confirm(user, id); }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CancelBookingDto) {
    return this.service.cancel(user, id, dto);
  }
}
