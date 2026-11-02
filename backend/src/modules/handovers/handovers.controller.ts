import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HandoverDto } from './dto';
import { HandoverKind } from './handover.entity';
import { HandoversService } from './handovers.service';
@ApiTags('Handovers') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller('bookings/:id')
export class HandoversController {
  constructor(private readonly service: HandoversService) {}
  @Post('pickup') @Roles(Role.ADMIN, Role.STAFF)
  pickup(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: HandoverDto) {
    return this.service.process(user, id, HandoverKind.PICKUP, dto);
  }
  @Post('return') @Roles(Role.ADMIN, Role.STAFF)
  returnVehicle(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: HandoverDto) {
    return this.service.process(user, id, HandoverKind.RETURN, dto);
  }
  @Get('handovers') records(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.list(user, id);
  }
}
