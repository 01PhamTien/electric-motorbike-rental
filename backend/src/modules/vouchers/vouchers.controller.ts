import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVoucherDto, PreviewVoucherDto, UpdateVoucherDto } from './dto';
import { VouchersService } from './vouchers.service';

@ApiTags('Vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly service: VouchersService) {}
  @Get()
  @Roles(Role.ADMIN)
  list() { return this.service.list(); }
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateVoucherDto) { return this.service.create(dto); }
  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVoucherDto) { return this.service.update(id, dto); }
  @Get(':id/redemptions')
  @Roles(Role.ADMIN)
  usage(@Param('id', ParseIntPipe) id: number) { return this.service.usage(id); }
  @Post('preview')
  @Roles(Role.CUSTOMER)
  preview(@CurrentUser() user: JwtUser, @Body() dto: PreviewVoucherDto) {
    return this.service.preview(user.sub, dto.code, dto.rentalAmount);
  }
}
