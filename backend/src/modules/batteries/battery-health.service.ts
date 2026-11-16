import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { AuditService } from '../audit/audit.service';
import { Battery } from './battery.entity';
import { BatteryHealthCheck, BatteryMaintenanceStatus, BatteryMaintenanceTask } from './battery-health.entity';
import { BatteryCostType, BatteryOperatingCost } from './battery-operating-cost.entity';

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
    else if(user.role===Role.STAFF){if(user.stationId==null)return {thresholds:this.thresholds(),total:0,healthy:0,watch:0,critical:0,retired:0,unknown:0,batteries:[]};qb.andWhere('b.stationId=:stationId',{stationId:user.stationId});}
    const batteries=await qb.orderBy('b.healthPercent','ASC').addOrderBy('b.cycleCount','DESC').getMany();
    const thresholds=this.thresholds();
    const classify=(b:Battery)=>b.status==='RETIRED'?'RETIRED':b.healthPercent===null?'UNKNOWN':b.healthPercent<=thresholds.criticalPercent?'CRITICAL':b.healthPercent<=thresholds.warningPercent||b.cycleCount>=thresholds.cycleWarning?'WATCH':'HEALTHY';
    const counts={total:batteries.length,healthy:0,watch:0,critical:0,retired:0,unknown:0};
    for(const b of batteries){const c=classify(b);if(c==='HEALTHY')counts.healthy++;else if(c==='WATCH')counts.watch++;else if(c==='CRITICAL')counts.critical++;else if(c==='UNKNOWN')counts.unknown++;else counts.retired++;}
    return {thresholds,...counts,batteries:batteries.map(b=>({...b,healthLevel:classify(b)}))};
  }
  async history(user:JwtUser,batteryId:number){
    const battery=await this.dataSource.getRepository(Battery).findOne({where:{id:batteryId}});
    if(!battery)throw new NotFoundException('Không tìm thấy pin');
    this.assertStation(user,battery.stationId);
    return this.dataSource.getRepository(BatteryHealthCheck).createQueryBuilder('h').leftJoin('h.recordedBy','u').addSelect(['u.id','u.fullName']).where('h.batteryId=:batteryId',{batteryId}).orderBy('h.createdAt','DESC').take(100).getMany();
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
      if(battery.status==='RETIRED'||battery.status==='TRANSFERRING')throw new BadRequestException('Không thể lập phiếu cho pin đã ngừng sử dụng hoặc đang điều chuyển');
      return tasks.save(tasks.create({batteryId:battery.id,stationId:battery.stationId,createdById:user.sub,completedById:null,taskType:dto.taskType,priority:dto.priority??'NORMAL',status:BatteryMaintenanceStatus.OPEN,dueAt:dto.dueAt?new Date(dto.dueAt):null,description:dto.description.trim(),result:null,cost:null,startedAt:null,completedAt:null}));
    });
    await this.audit.record(user.sub,'BATTERY_MAINTENANCE_CREATED','BATTERY_MAINTENANCE',task.id,{batteryId:task.batteryId,taskType:task.taskType});
    return task;
  }
  async updateTask(user:JwtUser,id:number,action:'start'|'complete'|'cancel',dto:{result?:string;cost?:number}={}){
    const task=await this.dataSource.transaction(async manager=>{
      const tasks=manager.getRepository(BatteryMaintenanceTask),batteries=manager.getRepository(Battery),costs=manager.getRepository(BatteryOperatingCost);
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
        if(dto.cost!==undefined){
          const existing=await costs.findOne({where:{maintenanceTaskId:id}});
          if(!existing)await costs.save(costs.create({batteryId:current.batteryId,stationId:current.stationId,costType:BatteryCostType.MAINTENANCE,amount:dto.cost.toFixed(2),energyKwh:null,unitPrice:null,maintenanceTaskId:id,recordedById:user.sub,occurredAt:current.completedAt,note:'Chi phí tự động từ phiếu bảo dưỡng #'+id}));
        }
      }else{
        if(current.status!==BatteryMaintenanceStatus.OPEN&&current.status!==BatteryMaintenanceStatus.IN_PROGRESS)throw new BadRequestException('Phiếu không thể hủy ở trạng thái hiện tại');
        current.status=BatteryMaintenanceStatus.CANCELLED;
      }
      return tasks.save(current);
    });
    await this.audit.record(user.sub,'BATTERY_MAINTENANCE_'+action.toUpperCase(),'BATTERY_MAINTENANCE',id,{status:task.status,cost:task.cost});
    return task;
  }

  private applyCostFilters(qb:SelectQueryBuilder<BatteryOperatingCost>,filters:{stationId?:number;from?:string;to?:string;costType?:string;batteryId?:number}){
    if(filters.stationId)qb.andWhere('c.stationId=:stationId',{stationId:filters.stationId});
    if(filters.from)qb.andWhere('c.occurredAt>=:from',{from:filters.from});
    if(filters.to)qb.andWhere('c.occurredAt<=:to',{to:filters.to});
    if(filters.costType)qb.andWhere('c.costType=:costType',{costType:filters.costType});
    if(filters.batteryId)qb.andWhere('c.batteryId=:batteryId',{batteryId:filters.batteryId});
    return qb;
  }
  private scopedCostFilters(user:JwtUser,filters:{stationId?:number;from?:string;to?:string;costType?:string;batteryId?:number}){
    if(filters.from&&Number.isNaN(new Date(filters.from).getTime()))throw new BadRequestException('Ngày bắt đầu không hợp lệ');
    if(filters.to&&Number.isNaN(new Date(filters.to).getTime()))throw new BadRequestException('Ngày kết thúc không hợp lệ');
    if(filters.from&&filters.to&&new Date(filters.from)>new Date(filters.to))throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    if(filters.stationId)this.assertStation(user,filters.stationId);
    if(user.role===Role.STAFF){if(user.stationId==null)throw new ForbiddenException('Tài khoản chưa được phân công trạm');return {...filters,stationId:user.stationId};}
    return filters;
  }
  async createOperatingCost(user:JwtUser,dto:{batteryId:number;costType:'CHARGING'|'REPLACEMENT'|'OTHER';amount?:number;energyKwh?:number;unitPrice?:number;occurredAt:string;note?:string}){
    let amount:number;
    if(dto.costType==='CHARGING'){
      if(dto.energyKwh===undefined||dto.unitPrice===undefined)throw new BadRequestException('Chi phí sạc cần nhập kWh và đơn giá điện');
      if(!Number.isFinite(dto.energyKwh)||dto.energyKwh<=0||!Number.isFinite(dto.unitPrice)||dto.unitPrice<0)throw new BadRequestException('kWh phải lớn hơn 0 và đơn giá không âm');
      amount=Math.round(dto.energyKwh*dto.unitPrice*100)/100;
    }else{
      if(dto.amount===undefined||!Number.isFinite(dto.amount)||dto.amount<0)throw new BadRequestException('Thành tiền phải là số không âm');
      amount=Math.round(dto.amount*100)/100;
    }
    const occurredAt=new Date(dto.occurredAt);
    if(Number.isNaN(occurredAt.getTime()))throw new BadRequestException('Ngày phát sinh không hợp lệ');
    const entry=await this.dataSource.transaction(async manager=>{
      const battery=await manager.getRepository(Battery).findOne({where:{id:dto.batteryId},lock:{mode:'pessimistic_write'}});
      if(!battery)throw new NotFoundException('Không tìm thấy pin');
      this.assertStation(user,battery.stationId);
      const repo=manager.getRepository(BatteryOperatingCost);
      return repo.save(repo.create({batteryId:battery.id,stationId:battery.stationId,costType:dto.costType as BatteryCostType,amount:amount.toFixed(2),energyKwh:dto.costType===BatteryCostType.CHARGING?dto.energyKwh!.toFixed(3):null,unitPrice:dto.costType===BatteryCostType.CHARGING?dto.unitPrice!.toFixed(2):null,maintenanceTaskId:null,recordedById:user.sub,occurredAt,note:dto.note?.trim()||null}));
    });
    await this.audit.record(user.sub,'BATTERY_OPERATING_COST_RECORDED','BATTERY_COST',entry.id,{batteryId:entry.batteryId,costType:entry.costType,amount:entry.amount});
    return entry;
  }
  async listOperatingCosts(user:JwtUser,filters:{stationId?:number;from?:string;to?:string;costType?:string;batteryId?:number}){
    const scoped=this.scopedCostFilters(user,filters);
    const qb=this.dataSource.getRepository(BatteryOperatingCost).createQueryBuilder('c').leftJoinAndSelect('c.battery','battery').leftJoinAndSelect('c.station','station').leftJoin('c.recordedBy','u').addSelect(['u.id','u.fullName']).orderBy('c.occurredAt','DESC').take(500);
    return this.applyCostFilters(qb,scoped).getMany();
  }
  async operatingCostSummary(user:JwtUser,filters:{stationId?:number;from?:string;to?:string}){
    const scoped=this.scopedCostFilters(user,filters),repo=this.dataSource.getRepository(BatteryOperatingCost);
    const base=()=>this.applyCostFilters(repo.createQueryBuilder('c'),scoped);
    const totals=await base().select('COUNT(c.id)','count').addSelect('COALESCE(SUM(c.amount),0)','total').getRawOne<{count:string;total:string}>();
    const byType=await base().select('c.costType','costType').addSelect('COUNT(c.id)','count').addSelect('SUM(c.amount)','amount').groupBy('c.costType').orderBy('SUM(c.amount)','DESC').getRawMany<{costType:string;count:string;amount:string}>();
    const byBattery=await base().leftJoin('c.battery','b').select('c.batteryId','batteryId').addSelect('b.serialNumber','serialNumber').addSelect('SUM(c.amount)','amount').addSelect('COUNT(c.id)','count').groupBy('c.batteryId').addGroupBy('b.serialNumber').orderBy('SUM(c.amount)','DESC').take(10).getRawMany<{batteryId:string;serialNumber:string;count:string;amount:string}>();
    const monthly=await base().select("CONVERT(char(7),c.occurredAt,126)",'month').addSelect('SUM(c.amount)','amount').groupBy("CONVERT(char(7),c.occurredAt,126)").orderBy("CONVERT(char(7),c.occurredAt,126)",'ASC').getRawMany<{month:string;amount:string}>();
    return {count:Number(totals?.count??0),total:Number(totals?.total??0),byType:byType.map(r=>({...r,count:Number(r.count),amount:Number(r.amount)})),byBattery:byBattery.map(r=>({...r,batteryId:Number(r.batteryId),count:Number(r.count),amount:Number(r.amount)})),monthly:monthly.map(r=>({...r,amount:Number(r.amount)}))};
  }

}
