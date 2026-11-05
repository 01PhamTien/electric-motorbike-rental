import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShiftHandoverDto } from './shift.dto';
import { AuditService } from './audit.service';

@ApiTags('Staff shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF)
@Controller('staff/shifts')
export class StaffShiftsController {
  constructor(private readonly service: AuditService) {}
  @Get('me') getMyShift(@CurrentUser() current: JwtUser) { return this.service.getMyShift(current.sub); }
  @Post('start') start(@CurrentUser() current: JwtUser, @Body() dto: ShiftHandoverDto) { return this.service.recordShift(current.sub, 'SHIFT_STARTED', dto); }
  @Post('end') end(@CurrentUser() current: JwtUser, @Body() dto: ShiftHandoverDto) { return this.service.recordShift(current.sub, 'SHIFT_ENDED', dto); }
}
