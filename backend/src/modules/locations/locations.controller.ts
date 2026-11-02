import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SimulateLocationDto } from './dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles/:vehicleId/locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Post('simulate')
  @Roles(Role.ADMIN, Role.STAFF)
  simulate(@CurrentUser() user: JwtUser, @Param('vehicleId', ParseIntPipe) vehicleId: number, @Body() dto: SimulateLocationDto) {
    return this.service.simulate(user, vehicleId, dto);
  }

  @Get('latest')
  @Roles(Role.ADMIN, Role.STAFF)
  latest(@CurrentUser() user: JwtUser, @Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.latest(user, vehicleId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  history(@CurrentUser() user: JwtUser, @Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.history(user, vehicleId);
  }
}
