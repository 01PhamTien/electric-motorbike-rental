import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { AuditService } from '../audit/audit.service';
import { Battery } from './battery.entity';
import { BatteryHealthCheck, BatteryMaintenanceStatus, BatteryMaintenanceTask } from './battery-health.entity';

@Injectable()
export class BatteryHealthService {
  constructor(private readonly dataSource:DataSource,private readonly audit:AuditService){}
  private assertStation(user:JwtUser,stationId:number){if(user.role===Role.STAFF&&user.stationId!==stationId)throw new ForbiddenException('Bạn chỉ được thao tác pin tại trạm được phân công');}
  private thresholds(){
    const warning=Number(process.env.BATTERY_HEALTH_WARNING_PERCENT??80),critical=Number(process.env.BATTERY_HEALTH_CRITICAL_PERCENT??65),cycles=Number(process.env.BATTERY_CYCLE_WARNING??500);
    if(!Number.isInteger(warning)||!Number.isInteger(critical)||!Number.isInteger(cycles)||critical<1||warning>100||critical>=warning||cycles<1)throw new Error('Battery health thresholds are invalid');
    return {warningPercent:warning,criticalPercent:critical,cycleWarning:cycles};
  }
  async summary(user:JwtUser,stationId?:number){
    const qb=this.dataSource.getRepository(Battery).createQueryBuilder('b').leftJoinAndSelect('b.station','station');
    if(stationId){this.assertStation(user,stationId);qb.andWhere('b.stationId=:stationId',{stationId});}
    else if(user.role===Role.STAFF){if(user.stationId==null)return {thresholds:this.thresholds(),total:0,healthy:0,watch:0,critical:0,retired:0,batteries:[]};qb.andWhere('b.stationId=:stationId',{stationId:user.stationId});}
    const batteries=await qb.orderBy('b.healthPercent','ASC').addOrderBy('b.cycleCount','DESC').getMany();
    const thresholds=this.thresholds();
    const classify=(b:Battery)=>b.status==='RETIRED'?'RETIRED':b.healthPercent<=thresholds.criticalPercent?'CRITICAL':b.healthPercent<=thresholds.warningPercent||b.cycleCount>=thresholds.cycleWarning?'WATCH':'HEALTHY';
    const counts={total:batteries.length,healthy:0,watch:0,critical:0,retired:0};
    for(const b of batteries){const c=classify(b);if(c==='HEALTHY')counts.healthy++;else if(c==='WATCH')counts.watch++;else if(c==='CRITICAL')counts.critical++;else counts.retired++;}
    return {thresholds,...counts,batteries:batteries.map(b=>({...b,healthLevel:classify(b)}))};
  }
  async history(user:JwtUser,batteryId:number){
    const battery=await this.dataSource.getRepository(Battery).findOne({where:{id:batteryId}});
    if(!battery)throw new NotFoundException('Không tìm thấy pin');
    this.assertStation(user,battery.stationId);
    return this.dataSource.getRepository(BatteryHealthCheck).find({where:{batteryId},relations:{recordedBy:true},order:{createdAt:'DESC'},take:100});
  }
  async record(user:JwtUser,batteryId:number,dto:{healthPercent:number;note?:string}){
    const check=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(Battery),history=manager.getRepository(BatteryHealthCheck);
      const battery=await repo.findOne({where:{id:batteryId},lock:{mode:'pessimistic_write'}});
      if(!battery)throw new NotFoundException('Không tìm thấy pin');
      this.assertStation(user,battery.stationId);
      if(battery.status==='RETIRED')throw new BadRequestException('Không thể đánh giá pin đã ngừng sử dụng');
      battery.healthPercent=dto.healthPercent;
      await repo.save(battery);
      return history.save(history.create({batteryId,stationId:battery.stationId,healthPercent:dto.healthPercent,cycleCount:battery.cycleCount,note:dto.note?.trim()||null,recordedById:user.sub}));
    });
    await this.audit.record(user.sub,'BATTERY_HEALTH_RECORDED','BATTERY',batteryId,{healthPercent:check.healthPercent,cycleCount:check.cycleCount});
    return check;
  }
  async listTasks(user:JwtUser,stationId?:number){
    const qb=this.dataSource.getRepository(BatteryMaintenanceTask).createQueryBuilder('t').leftJoinAndSelect('t.battery','battery').leftJoinAndSelect('t.createdBy','creator').leftJoinAndSelect('t.completedBy','completer').orderBy('t.createdAt','DESC').take(200);
    if(stationId){this.assertStation(user,stationId);qb.andWhere('t.stationId=:stationId',{stationId});}
    else if(user.role===Role.STAFF){if(user.stationId==null)return [];qb.andWhere('t.stationId=:stationId',{stationId:user.stationId});}
    return qb.getMany();
  }
  async createTask(user:JwtUser,dto:{batteryId:number;taskType:string;priority?:string;dueAt?:string;description:string}){
    const task=await this.dataSource.transaction(async manager=>{
      const repo=manager.getRepository(Battery),tasks=manager.getRepository(BatteryMaintenanceTask);
      const battery=await repo.findOne({where:{id:dto.batteryId},lock:{mode:'pessimistic_write'}});
      if(!battery)throw new NotFoundException('Không tìm thấy pin');
      this.assertStation(user,battery.stationId);
      if(battery.status==='RETIRED')throw new BadRequestException('Không thể lập phiếu cho pin đã ngừng sử dụng');
      return tasks.save(tasks.create({batteryId:battery.id,stationId:battery.stationId,createdById:user.sub,completedById:null,taskType:dto.taskType,priority:dto.priority??'NORMAL',status:BatteryMaintenanceStatus.OPEN,dueAt:dto.dueAt?new Date(dto.dueAt):null,description:dto.description.trim(),result:null,cost:null,startedAt:null,completedAt:null}));
    });
    await this.audit.record(user.sub,'BATTERY_MAINTENANCE_CREATED','BATTERY_MAINTENANCE',task.id,{batteryId:task.batteryId,taskType:task.taskType});
    return task;
  }
  async updateTask(user:JwtUser,id:number,action:'start'|'complete'|'cancel',dto:{result?:string;cost?:number}={}){
    const task=await this.dataSource.transaction(async manager=>{
      const tasks=manager.getRepository(BatteryMaintenanceTask),batteries=manager.getRepository(Battery);
      const current=await tasks.findOne({where:{id},lock:{mode:'pessimistic_write'}});
      if(!current)throw new NotFoundException('Không tìm thấy phiếu bảo dưỡng');
      this.assertStation(user,current.stationId);
      const battery=await batteries.findOne({where:{id:current.batteryId},lock:{mode:'pessimistic_write'}});
      if(!battery||battery.stationId!==current.stationId)throw new ConflictException('Pin đã thay đổi trạm; cần đối soát trước khi cập nhật phiếu');
      if(action==='start'){
        if(current.status!==BatteryMaintenanceStatus.OPEN)throw new BadRequestException('Chỉ phiếu OPEN mới được bắt đầu');
        current.status=BatteryMaintenanceStatus.IN_PROGRESS;current.startedAt=new Date();
      }else if(action==='complete'){
        if(current.status!==BatteryMaintenanceStatus.IN_PROGRESS)throw new BadRequestException('Chỉ phiếu đang thực hiện mới được hoàn tất');
        if(!dto.result?.trim())throw new BadRequestException('Cần nhập kết quả bảo dưỡng');
        if(dto.cost!==undefined&&(!Number.isFinite(dto.cost)||dto.cost<0))throw new BadRequestException('Chi phí phải là số không âm');
        current.status=BatteryMaintenanceStatus.COMPLETED;current.result=dto.result.trim();current.cost=dto.cost===undefined?null:String(dto.cost);current.completedById=user.sub;current.completedAt=new Date();
      }else{
        if(current.status!==BatteryMaintenanceStatus.OPEN&&current.status!==BatteryMaintenanceStatus.IN_PROGRESS)throw new BadRequestException('Phiếu không thể hủy ở trạng thái hiện tại');
        current.status=BatteryMaintenanceStatus.CANCELLED;
      }
      return tasks.save(current);
    });
    await this.audit.record(user.sub,'BATTERY_MAINTENANCE_'+action.toUpperCase(),'BATTERY_MAINTENANCE',id,{status:task.status,cost:task.cost});
    return task;
  }
}
