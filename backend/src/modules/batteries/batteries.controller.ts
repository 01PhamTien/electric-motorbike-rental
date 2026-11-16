import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BatteryStatus } from './battery.entity';
import { BatteriesService } from './batteries.service';
import { BatteryTransfersService } from './battery-transfers.service';
import { BatteryStocktakesService } from './battery-stocktakes.service';
import { CreateBatteryTransferDto, CreateBatteryStocktakeDto, UpdateBatteryStocktakeItemDto, AddBatteryStocktakeExtraDto } from './batteries.dto';
import { CreateBatteryDto, InstallBatteryDto, SwapBatteryDto, CreateBatteryReservationDto, RedeemBatteryReservationDto } from './batteries.dto';

@ApiTags('Batteries and swaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN,Role.STAFF)
@Controller('batteries')
export class BatteriesController {
  constructor(private readonly service:BatteriesService,private readonly transfers:BatteryTransfersService,private readonly stocktakes:BatteryStocktakesService){}
  @Get('transfers')
  @Roles(Role.ADMIN,Role.STAFF)
  listTransfers(@CurrentUser() user:JwtUser){return this.transfers.list(user);}
  @Post('transfers')
  @Roles(Role.ADMIN,Role.STAFF)
  createTransfer(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryTransferDto){return this.transfers.create(user,dto);}
  @Patch('transfers/:id/dispatch')
  @Roles(Role.ADMIN,Role.STAFF)
  dispatchTransfer(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.transfers.dispatch(user,id);}
  @Patch('transfers/:id/receive')
  @Roles(Role.ADMIN,Role.STAFF)
  receiveTransfer(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.transfers.receive(user,id);}
  @Patch('transfers/:id/cancel')
  @Roles(Role.ADMIN,Role.STAFF)
  cancelTransfer(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.transfers.cancel(user,id);}
  @Get('stocktakes')
  @Roles(Role.ADMIN,Role.STAFF)
  listStocktakes(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string){return this.stocktakes.list(user,stationId?Number(stationId):undefined);}
  @Post('stocktakes')
  @Roles(Role.ADMIN,Role.STAFF)
  createStocktake(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryStocktakeDto){return this.stocktakes.create(user,dto);}
  @Patch('stocktakes/:id/items/:itemId')
  @Roles(Role.ADMIN,Role.STAFF)
  updateStocktakeItem(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Param('itemId',ParseIntPipe) itemId:number,@Body() dto:UpdateBatteryStocktakeItemDto){return this.stocktakes.updateItem(user,id,itemId,dto);}
  @Post('stocktakes/:id/extras')
  @Roles(Role.ADMIN,Role.STAFF)
  addStocktakeExtra(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:AddBatteryStocktakeExtraDto){return this.stocktakes.addExtra(user,id,dto);}
  @Patch('stocktakes/:id/complete')
  @Roles(Role.ADMIN,Role.STAFF)
  completeStocktake(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.stocktakes.complete(user,id);}
  @Patch('stocktakes/:id/approve')
  @Roles(Role.ADMIN)
  approveStocktake(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.stocktakes.approve(user,id);}
  @Post('reservations')
  @Roles(Role.CUSTOMER)
  reserve(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryReservationDto){return this.service.reserve(user,dto);}
  @Get('reservations/my')
  @Roles(Role.CUSTOMER)
  myReservations(@CurrentUser() user:JwtUser){return this.service.myReservations(user);}
  @Patch('reservations/:id/cancel')
  @Roles(Role.CUSTOMER)
  cancelReservation(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.service.cancelReservation(user,id);}
  @Get('reservations')
  @Roles(Role.ADMIN,Role.STAFF)
  listReservations(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string){return this.service.listReservations(user,stationId?Number(stationId):undefined);}
  @Post('reservations/:id/redeem')
  @Roles(Role.ADMIN,Role.STAFF)
  redeemReservation(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:RedeemBatteryReservationDto){return this.service.redeemReservation(user,id,dto);}
  @Post() create(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryDto){return this.service.create(user,dto);}
  @Get() list(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string,@Query('status') status?:BatteryStatus){
    return this.service.list(user,stationId?Number(stationId):undefined,status);
  }
  @Post('install') install(@CurrentUser() user:JwtUser,@Body() dto:InstallBatteryDto){return this.service.install(user,dto);}
  @Post('swap') swap(@CurrentUser() user:JwtUser,@Body() dto:SwapBatteryDto){return this.service.swap(user,dto);}
  @Get('swaps/history') history(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string){return this.service.history(user,stationId?Number(stationId):undefined);}
  @Patch(':id/complete-charging') completeCharging(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.service.completeCharging(user,id);}
}
