import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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
import { BatteryHealthService } from './battery-health.service';
import { CreateBatteryTransferDto, CreateBatteryStocktakeDto, UpdateBatteryStocktakeItemDto, AddBatteryStocktakeExtraDto, RecordBatteryHealthDto, CreateBatteryMaintenanceTaskDto, CompleteBatteryMaintenanceTaskDto, CreateBatteryOperatingCostDto } from './batteries.dto';
import { CreateBatteryDto, InstallBatteryDto, SwapBatteryDto, CreateBatteryReservationDto, RedeemBatteryReservationDto, CompleteBatteryChargingDto, UpdateBatteryStatusDto, BatteryChargeHistoryQueryDto } from './batteries.dto';

class BatterySwapHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) stationId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) vehicleId?: number;
  @IsOptional() @IsString() serial?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

class BatteryInventoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) stationId?: number;
  @IsOptional() @IsEnum(BatteryStatus) status?: BatteryStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

@ApiTags('Batteries and swaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN,Role.STAFF)
@Controller('batteries')
export class BatteriesController {
  constructor(private readonly service:BatteriesService,private readonly transfers:BatteryTransfersService,private readonly stocktakes:BatteryStocktakesService,private readonly health:BatteryHealthService){}
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
  @Get('operating-costs/summary')
  @Roles(Role.ADMIN,Role.STAFF)
  operatingCostSummary(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string,@Query('from') from?:string,@Query('to') to?:string){return this.health.operatingCostSummary(user,{stationId:stationId?Number(stationId):undefined,from,to});}
  @Get('operating-costs')
  @Roles(Role.ADMIN,Role.STAFF)
  listOperatingCosts(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string,@Query('from') from?:string,@Query('to') to?:string,@Query('costType') costType?:string,@Query('batteryId') batteryId?:string){return this.health.listOperatingCosts(user,{stationId:stationId?Number(stationId):undefined,from,to,costType,batteryId:batteryId?Number(batteryId):undefined});}
  @Post('operating-costs')
  @Roles(Role.ADMIN,Role.STAFF)
  createOperatingCost(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryOperatingCostDto){return this.health.createOperatingCost(user,dto);}
  @Get('health/summary')
  @Roles(Role.ADMIN,Role.STAFF)
  healthSummary(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string){return this.health.summary(user,stationId?Number(stationId):undefined);}
  @Get(':id/health-history')
  @Roles(Role.ADMIN,Role.STAFF)
  healthHistory(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.health.history(user,id);}
  @Post(':id/health-checks')
  @Roles(Role.ADMIN,Role.STAFF)
  recordHealth(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:RecordBatteryHealthDto){return this.health.record(user,id,dto);}
  @Get('maintenance')
  @Roles(Role.ADMIN,Role.STAFF)
  listMaintenance(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string){return this.health.listTasks(user,stationId?Number(stationId):undefined);}
  @Post('maintenance')
  @Roles(Role.ADMIN,Role.STAFF)
  createMaintenance(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryMaintenanceTaskDto){return this.health.createTask(user,dto);}
  @Patch('maintenance/:id/start')
  @Roles(Role.ADMIN,Role.STAFF)
  startMaintenance(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.health.updateTask(user,id,'start');}
  @Patch('maintenance/:id/complete')
  @Roles(Role.ADMIN,Role.STAFF)
  completeMaintenance(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:CompleteBatteryMaintenanceTaskDto){return this.health.updateTask(user,id,'complete',dto);}
  @Patch('maintenance/:id/cancel')
  @Roles(Role.ADMIN,Role.STAFF)
  cancelMaintenance(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number){return this.health.updateTask(user,id,'cancel');}
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
  @Get('inventory/summary')
  inventorySummary(@CurrentUser() user: JwtUser, @Query('stationId') stationId?: string) {
    return this.service.inventorySummary(user, stationId ? Number(stationId) : undefined);
  }
  @Get('inventory')
  inventory(@CurrentUser() user: JwtUser, @Query() query: BatteryInventoryQueryDto) {
    return this.service.inventory(user, query);
  }
  @Post() create(@CurrentUser() user:JwtUser,@Body() dto:CreateBatteryDto){return this.service.create(user,dto);}
  @Get() list(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string,@Query('status') status?:BatteryStatus){
    return this.service.list(user,stationId?Number(stationId):undefined,status);
  }
  @Post('install') install(@CurrentUser() user:JwtUser,@Body() dto:InstallBatteryDto){return this.service.install(user,dto);}
  @Post('swap') swap(@CurrentUser() user:JwtUser,@Body() dto:SwapBatteryDto){return this.service.swap(user,dto);}
  @Get('swaps/history') history(@CurrentUser() user:JwtUser,@Query() query:BatterySwapHistoryQueryDto){return this.service.history(user,query);}
  @Patch(':id/complete-charging') completeCharging(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:CompleteBatteryChargingDto){return this.service.completeCharging(user,id,dto);}
  @Patch(':id/status') updateStatus(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:UpdateBatteryStatusDto){return this.service.updateStatus(user,id,dto);}
  @Get('charging/history') chargingHistory(@CurrentUser() user:JwtUser,@Query() query:BatteryChargeHistoryQueryDto){return this.service.chargingHistory(user,query);}
}
