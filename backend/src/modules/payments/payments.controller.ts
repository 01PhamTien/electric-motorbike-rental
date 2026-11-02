import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto';
import { PaymentsService } from './payments.service';
@ApiTags('Payments') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller('bookings/:id/payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Post() @Roles(Role.ADMIN, Role.STAFF)
  create(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreatePaymentDto) { return this.service.create(user, id, dto); }
  @Get() list(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) { return this.service.list(user, id); }
}
