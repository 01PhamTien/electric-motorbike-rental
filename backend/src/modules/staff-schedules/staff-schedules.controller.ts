import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateStaffScheduleDto, UpdateStaffScheduleDto } from './staff-schedule.dto';
import { StaffSchedulesService } from './staff-schedules.service';

@ApiTags('Staff schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class StaffSchedulesController {
  constructor(private readonly service: StaffSchedulesService) {}

  @Get('staff/schedules/me')
  @Roles(Role.STAFF)
  mine(@CurrentUser() current: JwtUser) { return this.service.mine(current.sub); }

  @Get('admin/staff-schedules')
  @Roles(Role.ADMIN)
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('staffId') staffId?: string, @Query('stationId') stationId?: string) {
    const validDate = (value?: string) => {
      if (!value) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z'))) throw new BadRequestException('Ngày lọc phải theo định dạng YYYY-MM-DD.');
      return value;
    };
    const validId = (value?: string) => {
      if (!value) return undefined;
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException('Mã nhân viên/trạm không hợp lệ.');
      return id;
    };
    const fromDate = validDate(from), toDate = validDate(to);
    if (fromDate && toDate && fromDate > toDate) throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
    return this.service.list({ from: fromDate, to: toDate, staffId: validId(staffId), stationId: validId(stationId) });
  }

  @Post('admin/staff-schedules')
  @Roles(Role.ADMIN)
  create(@CurrentUser() current: JwtUser, @Body() dto: CreateStaffScheduleDto) {
    return this.service.create(dto, current.sub);
  }

  @Patch('admin/staff-schedules/:id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffScheduleDto) {
    return this.service.update(id, dto);
  }
}
