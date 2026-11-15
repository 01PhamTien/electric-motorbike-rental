import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { AuditService } from '../audit/audit.service';
import { Station } from '../stations/station.entity';
import { Battery, BatteryStatus } from './battery.entity';
import { BatteryReservation, BatteryReservationStatus } from './battery-reservation.entity';
import { BatteryStocktake, BatteryStocktakeCountStatus, BatteryStocktakeItem, BatteryStocktakeStatus } from './battery-stocktake.entity';

@Injectable()
export class BatteryStocktakesService {
  constructor(private readonly dataSource:DataSource,private readonly audit:AuditService){}
  private assertStation(user:JwtUser,stationId:number){if(user.role===Role.STAFF&&user.stationId!==stationId)throw new ForbiddenException('Bạn chỉ được thao tác tại trạm được phân công');}
  async list(user:JwtUser,stationId?:number){
    const qb=this.dataSource.getRepository(BatteryStocktake).createQueryBuilder('s').leftJoinAndSelect('s.station','station')
      .leftJoinAndSelect('s.items','item').orderBy('s.createdAt','DESC').take(100);
    if(stationId){this.assertStation(user,stationId);qb.andWhere('s.stationId=:stationId',{stationId});}
    else if(user.role===Role.STAFF){if(user.stationId==null)return [];qb.andWhere('s.stationId=:stationId',{stationId:user.stationId});}
    return qb.getMany();
  }
  async create(user:JwtUser,dto:{stationId:number;note?:string}){
    this.assertStation(user,dto.stationId);
    const id=await this.dataSource.transaction(async manager=>{
      const stationRepo=manager.getRepository(Station),batteryRepo=manager.getRepository(Battery),reservationRepo=manager.getRepository(BatteryReservation);
      const stocktakeRepo=manager.getRepository(BatteryStocktake),itemRepo=manager.getRepository(BatteryStocktakeItem);
      const station=await stationRepo.findOne({where:{id:dto.stationId,isActive:true},lock:{mode:'pessimistic_write'}});
      if(!station)throw new NotFoundException('Không tìm thấy trạm hoặc trạm đã ngừng hoạt động');
      const open=await stocktakeRepo.findOne({where:{stationId:station.id,status:BatteryStocktakeStatus.OPEN},lock:{mode:'pessimistic_write'}});
      if(open)throw new ConflictException('Trạm đang có một đợt kiểm kê chưa hoàn tất');
      const batteries=await batteryRepo.find({where:{stationId:station.id},order:{id:'ASC'}});
      const holds=await reservationRepo.createQueryBuilder('r').where('r.stationId=:stationId',{stationId:station.id})
        .andWhere('r.status=:status',{status:BatteryReservationStatus.RESERVED}).andWhere('r.expiresAt>:now',{now:new Date()}).getCount();
      const stocktake=await stocktakeRepo.save(stocktakeRepo.create({stationId:station.id,createdById:user.sub,completedById:null,approvedById:null,status:BatteryStocktakeStatus.OPEN,note:dto.note?.trim()||null,heldReservationCount:holds,completedAt:null,approvedAt:null}));
      const rows=batteries.map(battery=>itemRepo.create({
        stocktakeId:stocktake.id,batteryId:battery.id,serialSnapshot:battery.serialNumber,systemStatus:battery.status,
        systemVehicleId:battery.vehicleId,exempt:battery.status===BatteryStatus.TRANSFERRING,
        countStatus:battery.status===BatteryStatus.TRANSFERRING?BatteryStocktakeCountStatus.PRESENT:BatteryStocktakeCountStatus.PENDING,
        observedStatus:null,note:battery.status===BatteryStatus.TRANSFERRING?'Đang điều chuyển tại thời điểm chụp snapshot':null,
      }));
      await itemRepo.save(rows);
      return stocktake.id;
    });
    await this.audit.record(user.sub,'BATTERY_STOCKTAKE_CREATED','BATTERY_STOCKTAKE',id,{stationId:dto.stationId});
    return this.dataSource.getRepository(BatteryStocktake).findOne({where:{id},relations:{station:true,items:true}});
  }
  async updateItem(user:JwtUser,stocktakeId:number,itemId:number,dto:{countStatus:BatteryStocktakeCountStatus;observedStatus?:string;note?:string}){
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryStocktake),itemRepo=manager.getRepository(BatteryStocktakeItem);
      const stocktake=await repo.findOne({where:{id:stocktakeId},lock:{mode:'pessimistic_write'}});
      if(!stocktake)throw new NotFoundException('Không tìm thấy đợt kiểm kê');
      this.assertStation(user,stocktake.stationId);
      if(stocktake.status!==BatteryStocktakeStatus.OPEN)throw new BadRequestException('Đợt kiểm kê đã khóa, không thể sửa');
      const item=await itemRepo.findOne({where:{id:itemId,stocktakeId},lock:{mode:'pessimistic_write'}});
      if(!item)throw new NotFoundException('Không tìm thấy dòng kiểm kê');
      if(item.exempt)throw new BadRequestException('Pin đang điều chuyển được miễn kiểm đếm trong đợt này');
      if(item.batteryId===null)throw new BadRequestException('Dòng pin thừa không thể cập nhật như pin trong snapshot');
      if(![BatteryStocktakeCountStatus.PRESENT,BatteryStocktakeCountStatus.MISSING].includes(dto.countStatus))throw new BadRequestException('Kết quả chỉ được là PRESENT hoặc MISSING');
      item.countStatus=dto.countStatus;item.observedStatus=dto.observedStatus?.trim()||null;item.note=dto.note?.trim()||null;
      return itemRepo.save(item);
    });
    await this.audit.record(user.sub,'BATTERY_STOCKTAKE_ITEM_RECORDED','BATTERY_STOCKTAKE',stocktakeId,{itemId,countStatus:dto.countStatus});
    return result;
  }
  async addExtra(user:JwtUser,stocktakeId:number,dto:{serialNumber:string;observedStatus?:string;note?:string}){
    const item=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryStocktake),itemRepo=manager.getRepository(BatteryStocktakeItem);
      const stocktake=await repo.findOne({where:{id:stocktakeId},lock:{mode:'pessimistic_write'}});
      if(!stocktake)throw new NotFoundException('Không tìm thấy đợt kiểm kê');
      this.assertStation(user,stocktake.stationId);
      if(stocktake.status!==BatteryStocktakeStatus.OPEN)throw new BadRequestException('Đợt kiểm kê đã khóa, không thể thêm dòng');
      const serial=dto.serialNumber.trim();
      const duplicate=await itemRepo.findOne({where:{stocktakeId,serialSnapshot:serial}});
      if(duplicate)throw new ConflictException('Serial này đã có trong biên bản kiểm kê');
      return itemRepo.save(itemRepo.create({stocktakeId,batteryId:null,serialSnapshot:serial,systemStatus:'NOT_IN_SYSTEM',systemVehicleId:null,exempt:false,countStatus:BatteryStocktakeCountStatus.EXTRA,observedStatus:dto.observedStatus?.trim()||null,note:dto.note?.trim()||'Pin không có trong danh sách hệ thống'}));
    });
    await this.audit.record(user.sub,'BATTERY_STOCKTAKE_EXTRA_ADDED','BATTERY_STOCKTAKE',stocktakeId,{serialNumber:dto.serialNumber.trim()});
    return item;
  }
  async complete(user:JwtUser,stocktakeId:number){
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryStocktake),itemRepo=manager.getRepository(BatteryStocktakeItem);
      const stocktake=await repo.findOne({where:{id:stocktakeId},lock:{mode:'pessimistic_write'}});
      if(!stocktake)throw new NotFoundException('Không tìm thấy đợt kiểm kê');
      this.assertStation(user,stocktake.stationId);
      if(stocktake.status!==BatteryStocktakeStatus.OPEN)throw new BadRequestException('Đợt kiểm kê không còn mở');
      const pending=await itemRepo.count({where:{stocktakeId,countStatus:BatteryStocktakeCountStatus.PENDING}});
      if(pending>0)throw new BadRequestException('Cần ghi nhận tất cả pin trong snapshot trước khi hoàn tất');
      stocktake.status=BatteryStocktakeStatus.COMPLETED;stocktake.completedById=user.sub;stocktake.completedAt=new Date();
      return repo.save(stocktake);
    });
    await this.audit.record(user.sub,'BATTERY_STOCKTAKE_COMPLETED','BATTERY_STOCKTAKE',stocktakeId);
    return result;
  }
  async approve(user:JwtUser,stocktakeId:number){
    if(user.role!==Role.ADMIN)throw new ForbiddenException('Chỉ ADMIN mới được duyệt biên bản kiểm kê');
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryStocktake),itemRepo=manager.getRepository(BatteryStocktakeItem);
      const stocktake=await repo.findOne({where:{id:stocktakeId},lock:{mode:'pessimistic_write'}});
      if(!stocktake)throw new NotFoundException('Không tìm thấy đợt kiểm kê');
      if(stocktake.status!==BatteryStocktakeStatus.COMPLETED)throw new BadRequestException('Chỉ được duyệt biên bản đã hoàn tất');
      stocktake.status=BatteryStocktakeStatus.APPROVED;stocktake.approvedById=user.sub;stocktake.approvedAt=new Date();
      return repo.save(stocktake);
    });
    const summary=await this.dataSource.getRepository(BatteryStocktakeItem).createQueryBuilder('i')
      .select('i.countStatus','countStatus').addSelect('COUNT(*)','count').where('i.stocktakeId=:id',{id:stocktakeId}).groupBy('i.countStatus').getRawMany();
    await this.audit.record(user.sub,'BATTERY_STOCKTAKE_APPROVED','BATTERY_STOCKTAKE',stocktakeId,{summary});
    return {...result,summary};
  }
}
