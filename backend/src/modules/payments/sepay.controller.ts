import { BadRequestException, Body, Controller, Headers, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly service: SePayService) {}

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

  @Post('ipn')
  handleIpn(@Body() payload: unknown, @Headers('x-secret-key') secret: string) {
    return this.service.handleIpn(payload, secret);
  }
}
