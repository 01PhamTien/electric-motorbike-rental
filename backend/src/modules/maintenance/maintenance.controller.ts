import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance-records')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  list(@CurrentUser() user: JwtUser, @Query('vehicleId') vehicleId?: string) {
    return this.service.list(user, vehicleId ? Number(vehicleId) : undefined);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMaintenanceDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  update(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMaintenanceDto) {
    return this.service.update(user, id, dto);
  }
}
