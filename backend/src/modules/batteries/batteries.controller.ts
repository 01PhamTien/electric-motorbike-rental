import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BatteryStatus } from './battery.entity';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BatteriesService } from './batteries.service';
import { CreateBatteryDto, InstallBatteryDto, SwapBatteryDto, CreateBatteryReservationDto, RedeemBatteryReservationDto, CompleteBatteryChargingDto, UpdateBatteryHealthDto, BatteryMaintenanceDto } from './batteries.dto';

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
  constructor(private readonly service:BatteriesService){}
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
  @Get('swaps/history') history(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string){return this.service.history(user,stationId?Number(stationId):undefined);}
  @Patch(':id/complete-charging') completeCharging(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:CompleteBatteryChargingDto){return this.service.completeCharging(user,id,dto.healthPercent,dto.note);}
  @Get('charging/history') chargingHistory(@CurrentUser() user:JwtUser,@Query('stationId') stationId?:string,@Query('batteryId') batteryId?:string){return this.service.chargingHistory(user,stationId?Number(stationId):undefined,batteryId?Number(batteryId):undefined);}
  @Patch(':id/health') updateHealth(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:UpdateBatteryHealthDto){return this.service.updateHealth(user,id,dto.healthPercent,dto.note);}
  @Patch(':id/maintenance') setMaintenance(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:BatteryMaintenanceDto){return this.service.setMaintenance(user,id,dto.note);}
  @Patch(':id/maintenance/complete') completeMaintenance(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:BatteryMaintenanceDto){return this.service.completeMaintenance(user,id,dto.note);}
  @Patch(':id/retire') retireBattery(@CurrentUser() user:JwtUser,@Param('id',ParseIntPipe) id:number,@Body() dto:BatteryMaintenanceDto){return this.service.retireBattery(user,id,dto.note);}
}
