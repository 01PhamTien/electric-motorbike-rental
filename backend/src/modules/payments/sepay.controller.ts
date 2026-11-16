import { BadRequestException, Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentPurpose } from './payment.entity';
import { SePayService } from './sepay.service';

@ApiTags('SePay')
@Controller('payments/sepay')
export class SePayController {
  constructor(
    private readonly service: SePayService,
    private readonly config: ConfigService,
  ) {}

  @Post('bookings/:id/checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createCheckout(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { purpose: PaymentPurpose.RENT | PaymentPurpose.DEPOSIT },
  ) {
    if (![PaymentPurpose.RENT, PaymentPurpose.DEPOSIT].includes(body?.purpose)) {
      throw new BadRequestException('purpose must be RENT or DEPOSIT');
    }
    return this.service.createCheckout(user, id, body.purpose);
  }

  // SePay requires public callback URLs. Redirect the customer's browser back to the local frontend
  // only after SePay has reached this public backend callback endpoint.
  @Get('return')
  @Redirect()
  handleReturn(
    @Query('bookingId') bookingId: string,
    @Query('invoice') invoice: string,
    @Query('result') result: string,
  ) {
    if (!/^\d+$/.test(bookingId || '') || !invoice || !['success', 'error', 'cancel'].includes(result)) {
      throw new BadRequestException('SePay return parameters are invalid');
    }
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) throw new BadRequestException('Frontend return URL is not configured');
    const url = new URL('/bookings/' + bookingId + '/payments', frontendUrl);
    url.searchParams.set('sepay', invoice);
    url.searchParams.set('result', result);
    return { url: url.toString(), statusCode: 302 };
  }

  @Post('ipn')
  handleIpn(@Body() payload: unknown, @Headers('x-secret-key') secret: string) {
    return this.service.handleIpn(payload, secret);
  }
}
