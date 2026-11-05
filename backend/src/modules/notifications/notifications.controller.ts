import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() list(@CurrentUser() user: JwtUser) { return this.service.listMine(user.sub); }
  @Get('unread-count') unreadCount(@CurrentUser() user: JwtUser) { return this.service.unreadCount(user.sub); }
  @Patch('read-all') markAllRead(@CurrentUser() user: JwtUser) { return this.service.markAllRead(user.sub); }
  @Patch(':id/read') markRead(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) { return this.service.markRead(user.sub, id); }
}
