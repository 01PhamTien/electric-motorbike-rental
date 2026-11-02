import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
@Controller('locations')
export class ManagedLocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Vị trí mô phỏng gần nhất của các xe trong phạm vi quản lý' })
  latestForManagedVehicles(@CurrentUser() user: JwtUser) {
    return this.service.latestForManagedVehicles(user);
  }
}
