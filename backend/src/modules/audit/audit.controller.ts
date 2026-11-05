import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';
import { ShiftHandoverDto } from './shift.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get('staff/shifts/me') @Roles(Role.STAFF) myShift(@CurrentUser() current: JwtUser) {
    return this.service.getMyShift(current.sub);
  }
  @Post('staff/shifts/start') @Roles(Role.STAFF) startShift(@CurrentUser() current: JwtUser, @Body() dto: ShiftHandoverDto) {
    return this.service.recordShift(current.sub, 'SHIFT_STARTED', dto);
  }
  @Post('staff/shifts/end') @Roles(Role.STAFF) endShift(@CurrentUser() current: JwtUser, @Body() dto: ShiftHandoverDto) {
    return this.service.recordShift(current.sub, 'SHIFT_ENDED', dto);
  }

  @Get() @Roles(Role.ADMIN) list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.service.list(Number.isInteger(parsed) ? parsed : 100);
  }
}
