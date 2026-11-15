import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { AuditService } from '../audit/audit.service';
import { Station } from '../stations/station.entity';
import { Battery, BatteryStatus } from './battery.entity';
import { BatteryReservation, BatteryReservationStatus } from './battery-reservation.entity';
import { BatteryTransfer, BatteryTransferItem, BatteryTransferStatus } from './battery-transfer.entity';

@Injectable()
export class BatteryTransfersService {
  constructor(private readonly dataSource:DataSource,private readonly audit:AuditService){}
  private assertStation(user:JwtUser,stationId:number){if(user.role===Role.STAFF&&user.stationId!==stationId)throw new ForbiddenException('Bạn chỉ được thao tác tại trạm được phân công');}

  async list(user:JwtUser){
    const qb=this.dataSource.getRepository(BatteryTransfer).createQueryBuilder('t')
      .leftJoinAndSelect('t.sourceStation','source').leftJoinAndSelect('t.destinationStation','destination')
      .leftJoinAndSelect('t.items','item').leftJoinAndSelect('item.battery','battery')
      .orderBy('t.createdAt','DESC').take(200);
    if(user.role===Role.STAFF){if(user.stationId==null)return [];qb.andWhere('(t.sourceStationId=:stationId OR t.destinationStationId=:stationId)',{stationId:user.stationId});}
    return qb.getMany();
  }

  async create(user:JwtUser,dto:{sourceStationId:number;destinationStationId:number;batteryIds:number[];note?:string}){
    if(dto.sourceStationId===dto.destinationStationId)throw new BadRequestException('Trạm nhận phải khác trạm gửi');
    if(!Array.isArray(dto.batteryIds)||dto.batteryIds.length<1||dto.batteryIds.length>100||new Set(dto.batteryIds).size!==dto.batteryIds.length)throw new BadRequestException('Danh sách pin phải có từ 1 đến 100 mã pin không trùng nhau');
    this.assertStation(user,dto.sourceStationId);
    const id=await this.dataSource.transaction(async manager=>{
      const stationRepo=manager.getRepository(Station),batteryRepo=manager.getRepository(Battery);
      const reservationRepo=manager.getRepository(BatteryReservation),transferRepo=manager.getRepository(BatteryTransfer),itemRepo=manager.getRepository(BatteryTransferItem);
      const source=await stationRepo.findOne({where:{id:dto.sourceStationId,isActive:true},lock:{mode:'pessimistic_write'}});
      const destination=await stationRepo.findOne({where:{id:dto.destinationStationId,isActive:true}});
      if(!source||!destination)throw new NotFoundException('Trạm gửi hoặc trạm nhận không tồn tại/đã ngừng hoạt động');
      const ids=[...dto.batteryIds].sort((a,b)=>a-b);
      const batteries=[];
      for(const batteryId of ids){const battery=await batteryRepo.findOne({where:{id:batteryId},lock:{mode:'pessimistic_write'}});if(!battery)throw new NotFoundException('Không tìm thấy pin #'+batteryId);batteries.push(battery);}
      const now=new Date();
      for(const battery of batteries){
        if(battery.stationId!==source.id||battery.status!==BatteryStatus.FULL||battery.vehicleId!==null)throw new BadRequestException('Chỉ được điều chuyển pin FULL đang nằm trong kho trạm gửi');
        const held=await reservationRepo.createQueryBuilder('r').where('r.stationId=:stationId',{stationId:source.id})
          .andWhere('r.status=:status',{status:BatteryReservationStatus.RESERVED}).andWhere('r.expiresAt>:now',{now})
          .getCount();
        if(held>0){const totalFull=await batteryRepo.count({where:{stationId:source.id,status:BatteryStatus.FULL,vehicleId:null}});if(totalFull<=held)throw new ConflictException('Tồn kho pin đang được giữ trước; không thể điều chuyển làm thiếu pin đã đặt');}
        battery.status=BatteryStatus.TRANSFERRING;
      }
      await batteryRepo.save(batteries);
      const transfer=await transferRepo.save(transferRepo.create({sourceStationId:source.id,destinationStationId:destination.id,createdById:user.sub,dispatchedById:null,receivedById:null,status:BatteryTransferStatus.PENDING,note:dto.note?.trim()||null,dispatchedAt:null,receivedAt:null,cancelledAt:null}));
      await itemRepo.save(ids.map(batteryId=>itemRepo.create({transferId:transfer.id,batteryId,serialSnapshotId:batteryId})));
      return transfer.id;
    });
    await this.audit.record(user.sub,'BATTERY_TRANSFER_CREATED','BATTERY_TRANSFER',id,{sourceStationId:dto.sourceStationId,destinationStationId:dto.destinationStationId,batteryIds:dto.batteryIds});
    return this.dataSource.getRepository(BatteryTransfer).findOne({where:{id},relations:{items:{battery:true},sourceStation:true,destinationStation:true}});
  }

  async dispatch(user:JwtUser,id:number){
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryTransfer),batteryRepo=manager.getRepository(Battery),stationRepo=manager.getRepository(Station);
      const hint=await repo.findOne({where:{id}});if(!hint)throw new NotFoundException('Không tìm thấy phiếu điều chuyển');
      await stationRepo.findOne({where:{id:hint.sourceStationId},lock:{mode:'pessimistic_write'}});
      const transfer=await repo.findOne({where:{id},relations:{items:true},lock:{mode:'pessimistic_write'}});
      if(!transfer)throw new NotFoundException('Không tìm thấy phiếu điều chuyển');
      this.assertStation(user,transfer.sourceStationId);
      if(transfer.status!==BatteryTransferStatus.PENDING)throw new BadRequestException('Phiếu không còn ở trạng thái chờ bàn giao');
      const ids=transfer.items.map(x=>x.batteryId).sort((a,b)=>a-b);
      for(const batteryId of ids){const battery=await batteryRepo.findOne({where:{id:batteryId},lock:{mode:'pessimistic_write'}});if(!battery||battery.status!==BatteryStatus.TRANSFERRING||battery.stationId!==transfer.sourceStationId)throw new ConflictException('Dữ liệu pin không còn khớp với phiếu điều chuyển');}
      transfer.status=BatteryTransferStatus.IN_TRANSIT;transfer.dispatchedById=user.sub;transfer.dispatchedAt=new Date();
      return repo.save(transfer);
    });
    await this.audit.record(user.sub,'BATTERY_TRANSFER_DISPATCHED','BATTERY_TRANSFER',id);
    return result;
  }

  async receive(user:JwtUser,id:number){
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryTransfer),batteryRepo=manager.getRepository(Battery),stationRepo=manager.getRepository(Station);
      const hint=await repo.findOne({where:{id}});if(!hint)throw new NotFoundException('Không tìm thấy phiếu điều chuyển');
      await stationRepo.findOne({where:{id:hint.destinationStationId},lock:{mode:'pessimistic_write'}});
      const transfer=await repo.findOne({where:{id},relations:{items:true},lock:{mode:'pessimistic_write'}});
      if(!transfer)throw new NotFoundException('Không tìm thấy phiếu điều chuyển');
      this.assertStation(user,transfer.destinationStationId);
      if(transfer.status!==BatteryTransferStatus.IN_TRANSIT)throw new BadRequestException('Phiếu chưa được bàn giao hoặc đã hoàn tất');
      const ids=transfer.items.map(x=>x.batteryId).sort((a,b)=>a-b),batteries=[];
      for(const batteryId of ids){const battery=await batteryRepo.findOne({where:{id:batteryId},lock:{mode:'pessimistic_write'}});if(!battery||battery.status!==BatteryStatus.TRANSFERRING||battery.stationId!==transfer.sourceStationId)throw new ConflictException('Pin trong phiếu đã thay đổi; cần kiểm kê trước khi tiếp nhận');batteries.push(battery);}
      for(const battery of batteries){battery.stationId=transfer.destinationStationId;battery.status=BatteryStatus.FULL;battery.vehicleId=null;}
      await batteryRepo.save(batteries);
      transfer.status=BatteryTransferStatus.COMPLETED;transfer.receivedById=user.sub;transfer.receivedAt=new Date();
      return repo.save(transfer);
    });
    await this.audit.record(user.sub,'BATTERY_TRANSFER_RECEIVED','BATTERY_TRANSFER',id,{destinationStationId:result.destinationStationId});
    return result;
  }

  async cancel(user:JwtUser,id:number){
    const result=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(BatteryTransfer),batteryRepo=manager.getRepository(Battery),stationRepo=manager.getRepository(Station);
      const hint=await repo.findOne({where:{id}});if(!hint)throw new NotFoundException('Không tìm thấy phiếu điều chuyển');
      await stationRepo.findOne({where:{id:hint.sourceStationId},lock:{mode:'pessimistic_write'}});
      const transfer=await repo.findOne({where:{id},relations:{items:true},lock:{mode:'pessimistic_write'}});
      if(!transfer)throw new NotFoundException('Không tìm thấy phiếu điều chuyển');
      this.assertStation(user,transfer.sourceStationId);
      if(transfer.status!==BatteryTransferStatus.PENDING)throw new BadRequestException('Chỉ được hủy phiếu trước khi bàn giao');
      const batteries=[];
      for(const batteryId of transfer.items.map(x=>x.batteryId).sort((a,b)=>a-b)){const battery=await batteryRepo.findOne({where:{id:batteryId},lock:{mode:'pessimistic_write'}});if(!battery||battery.status!==BatteryStatus.TRANSFERRING)throw new ConflictException('Pin không còn khớp với phiếu');battery.status=BatteryStatus.FULL;batteries.push(battery);}
      await batteryRepo.save(batteries);
      transfer.status=BatteryTransferStatus.CANCELLED;transfer.cancelledAt=new Date();return repo.save(transfer);
    });
    await this.audit.record(user.sub,'BATTERY_TRANSFER_CANCELLED','BATTERY_TRANSFER',id);
    return result;
  }
}
