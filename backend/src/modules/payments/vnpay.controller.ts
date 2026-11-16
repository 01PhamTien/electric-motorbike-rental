import { Controller, Get, Param, Query, Redirect, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VnPayService } from './vnpay.service';
import { VnPayParams } from './vnpay.util';

@ApiTags('VNPay')
@Controller('payments/vnpay')
export class VnPayController {
  constructor(private readonly service: VnPayService) {}

  @Get('ipn')
  ipn(@Query() params: VnPayParams) {
    return this.service.processIpn(params);
  }

  @Get('return')
  @Redirect()
  async paymentReturn(@Query() params: VnPayParams) {
    return { url: await this.service.resolveReturn(params), statusCode: 302 };
  }

  @Get(':txnRef')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  status(@CurrentUser() user: JwtUser, @Param('txnRef') txnRef: string) {
    return this.service.getStatus(user, txnRef);
  }
}
