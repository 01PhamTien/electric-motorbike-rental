import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOperatingCostDto } from './operating-cost.dto';
import { OperatingCostCategory } from './operating-cost.entity';
import { OperatingCostsService } from './operating-costs.service';

@ApiTags('Operating costs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
@Controller('operating-costs')
export class OperatingCostsController {
  constructor(private readonly service: OperatingCostsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOperatingCostDto) {
    return this.service.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('stationId') stationId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('category') category?: OperatingCostCategory,
  ) {
    return this.service.list(user, {
      from, to,
      stationId: stationId ? Number(stationId) : undefined,
      vehicleId: vehicleId ? Number(vehicleId) : undefined,
      category,
    });
  }
}
