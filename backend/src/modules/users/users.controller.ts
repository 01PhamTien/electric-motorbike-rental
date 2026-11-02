import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChangePasswordDto, CreateStaffDto, UpdateAvatarDto, UpdateMyProfileDto, UpdateStaffDto, UpdateStaffStatusDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() current: JwtUser) {
    return this.usersService.findById(current.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() current: JwtUser, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(current.sub, dto);
  }

  @Patch('me/password')
  changeMyPassword(@CurrentUser() current: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(current.sub, dto);
  }

  @Patch('me/avatar')
  updateMyAvatar(@CurrentUser() current: JwtUser, @Body() dto: UpdateAvatarDto) {
    return this.usersService.updateAvatar(current.sub, dto.avatarDataUrl);
  }

  @Get('staff')
  @Roles(Role.ADMIN)
  listStaff() {
    return this.usersService.listStaff();
  }

  @Post('staff')
  @Roles(Role.ADMIN)
  createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaff(dto);
  }

  @Patch('staff/:id')
  @Roles(Role.ADMIN)
  updateStaff(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto) {
    return this.usersService.updateStaff(id, dto);
  }

  @Patch('staff/:id/status')
  @Roles(Role.ADMIN)
  updateStaffStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffStatusDto) {
    return this.usersService.updateStaffStatus(id, dto.status);
  }
}
