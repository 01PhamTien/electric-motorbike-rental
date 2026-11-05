import { Controller, Get, Param, ParseIntPipe, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVehicleTransferDto, TransferInspectionDto } from './vehicle-transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('Vehicle transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  list(@CurrentUser() user: JwtUser) { return this.service.list(user); }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateVehicleTransferDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id/dispatch')
  @Roles(Role.ADMIN, Role.STAFF)
  dispatch(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: TransferInspectionDto) {
    return this.service.dispatch(user, id, dto);
  }

  @Patch(':id/receive')
  @Roles(Role.ADMIN, Role.STAFF)
  receive(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: TransferInspectionDto) {
    return this.service.receive(user, id, dto);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.STAFF)
  cancel(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(user, id);
  }
}
