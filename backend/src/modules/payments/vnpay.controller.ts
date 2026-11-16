import { BadRequestException, Body, Controller, Get, Ip, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateVnPayCheckoutDto } from './vnpay.dto';
import { VnPayService } from './vnpay.service';
import { VnPayParams } from './vnpay.util';

@ApiTags('VNPay')
@Controller('payments/vnpay')
export class VnPayController {
  constructor(private readonly service: VnPayService) {}

  @Post('bookings/:id/checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createCheckout(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateVnPayCheckoutDto,
    @Ip() ip: string,
  ) {
    const bookingId = Number(id);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      throw new BadRequestException('Mã đơn thuê không hợp lệ.');
    }
    return this.service.createCheckout(user, bookingId, dto, ip || '127.0.0.1');
  }

  @Get('status/:txnRef')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  status(@CurrentUser() user: JwtUser, @Param('txnRef') txnRef: string) {
    return this.service.getStatus(user, txnRef);
  }

  @Get('ipn')
  ipn(@Query() query: VnPayParams) {
    return this.service.handleIpn(query);
  }

  @Get('return')
  returnFromGateway(@Query('vnp_TxnRef') txnRef: string, @Res() response: Response) {
    return response.redirect(303, this.service.redirectAfterReturn(txnRef));
  }
}
