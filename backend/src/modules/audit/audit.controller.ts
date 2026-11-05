import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get('staff-presence') @Roles(Role.ADMIN) staffPresence() {
    return this.service.staffPresence();
  }

  @Get('shifts') @Roles(Role.ADMIN) listShifts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('staffId') staffId?: string,
    @Query('stationId') stationId?: string,
    @Query('limit') limit?: string,
  ) {
    const validDate = (value?: string) => {
      if (value === undefined || value === '') return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z'))) {
        throw new BadRequestException('Ngày lọc phải theo định dạng YYYY-MM-DD.');
      }
      return value;
    };
    const validId = (value?: string) => {
      if (value === undefined || value === '') return undefined;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) throw new BadRequestException('Mã nhân viên/trạm không hợp lệ.');
      return parsed;
    };
    const fromDate = validDate(from), toDate = validDate(to);
    if (fromDate && toDate && fromDate > toDate) throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
    return this.service.listShifts({
      from: fromDate, to: toDate, staffId: validId(staffId),
      stationId: validId(stationId), limit: limit && Number.isInteger(Number(limit)) ? Number(limit) : 100,
    });
  }

  @Get() @Roles(Role.ADMIN) list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.service.list(Number.isInteger(parsed) ? parsed : 100);
  }
}
