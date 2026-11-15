import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { Battery, BatteryStatus } from '../src/modules/batteries/battery.entity';
import { BatterySwap } from '../src/modules/batteries/battery-swap.entity';
import { BatteryReservation } from '../src/modules/batteries/battery-reservation.entity';
import { BatteryChargeSession } from '../src/modules/batteries/battery-charge-session.entity';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';
import { Role } from '../src/common/enums/role.enum';

function fixture(){
  const vehicle:any={id:12,code:'VG-12',stationId:2,isActive:true};
  const removed:any={id:1,serialNumber:'BAT-OLD',stationId:2,vehicleId:12,status:BatteryStatus.INSTALLED,cycleCount:10};
  const replacement:any={id:2,serialNumber:'BAT-FULL',stationId:2,vehicleId:null,status:BatteryStatus.FULL,cycleCount:4};
  const batteries=[removed,replacement],swaps:any[]=[],sessions:any[]=[];
  const batteryRepo:any={
    findOne:async({where}:any)=>{
      if(where.id!==undefined)return batteries.find(b=>b.id===where.id)??null;
      if(where.vehicleId!==undefined)return batteries.find(b=>b.vehicleId===where.vehicleId&&b.status===where.status)??null;
      return null;
    },
    save:async(value:any)=>value,
    count:async()=>2,
  };
  const swapRepo:any={create:(value:any)=>value,save:async(value:any)=>{const saved={...value,id:swaps.length+1};swaps.push(saved);return saved;}};
  const chargeRepo:any={
    findOne:async({where}:any)=>sessions.find(s=>s.batteryId===where.batteryId&&s.completedAt===null)??null,
    create:(value:any)=>value,
    save:async(value:any)=>{if(!value.id)value.id=sessions.length+1;const i=sessions.findIndex(s=>s.id===value.id);if(i>=0)sessions[i]=value;else sessions.push(value);return value;},
    createQueryBuilder:()=>({leftJoinAndSelect:()=>chargeRepo.createQueryBuilder(),leftJoin:()=>chargeRepo.createQueryBuilder(),addSelect:()=>chargeRepo.createQueryBuilder(),orderBy:()=>chargeRepo.createQueryBuilder(),addOrderBy:()=>chargeRepo.createQueryBuilder(),andWhere:()=>chargeRepo.createQueryBuilder(),skip:()=>chargeRepo.createQueryBuilder(),take:()=>chargeRepo.createQueryBuilder(),getManyAndCount:async()=>[sessions,sessions.length]}),
  };
  const vehicleRepo:any={findOne:async()=>vehicle};
  const reservationQuery:any={where:()=>reservationQuery,andWhere:()=>reservationQuery,getCount:async()=>0,update:()=>({set:()=>({where:()=>({execute:async()=>({})})})}),select:()=>({addSelect:()=>({where:()=>({andWhere:()=>({andWhere:()=>({groupBy:()=>({getRawMany:async()=>[]})})})})})})};
  const reservationRepo:any={findOne:async()=>null,create:(value:any)=>value,save:async(value:any)=>value,createQueryBuilder:()=>reservationQuery};
  const stationRepo:any={findOne:async()=>({id:2,isActive:true})};
  const manager:any={getRepository:(entity:any)=>entity===Battery?batteryRepo:entity===BatterySwap?swapRepo:entity===BatteryReservation?reservationRepo:entity===BatteryChargeSession?chargeRepo:entity===Vehicle?vehicleRepo:stationRepo};
  const dataSource:any={transaction:async(fn:any)=>fn(manager)};
  const service=new BatteriesService(dataSource,batteryRepo,swapRepo,reservationRepo,stationRepo,vehicleRepo);
  return {service,batteries,swaps,sessions,vehicle};
}
const staff={sub:5,email:'staff@example.test',role:Role.STAFF,stationId:2};

test('battery swap atomically installs full battery and sends removed battery to charging',async()=>{
  const {service,batteries,swaps,sessions}=fixture();
  const result=await service.swap(staff,{vehicleId:12,replacementBatteryId:2,note:'Khách cần đi ngay'});
  assert.equal(result.removedBattery.status,BatteryStatus.CHARGING);
  assert.equal(result.removedBattery.vehicleId,null);
  assert.equal(result.installedBattery.status,BatteryStatus.INSTALLED);
  assert.equal(result.installedBattery.vehicleId,12);
  assert.equal(swaps.length,1);
  assert.equal(swaps[0].removedBatteryId,1);
  assert.equal(swaps[0].installedBatteryId,2);
  assert.equal(sessions.length,1);
  assert.equal(sessions[0].batteryId,1);
  assert.equal(sessions[0].startedById,staff.sub);
  assert.equal(sessions[0].completedAt,null);
});

test('battery swap rejects a full battery from a different station',async()=>{
  const {service,batteries}=fixture();
  batteries[1].stationId=9;
  await assert.rejects(()=>service.swap(staff,{vehicleId:12,replacementBatteryId:2}),/cùng một trạm|trạm hiện tại/);
});

test('battery swap is restricted to the staff assigned station',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.swap({...staff,stationId:9},{vehicleId:12,replacementBatteryId:2}),/ngoài trạm được phân công/);
});

test('completing a charge closes its session and increments cycle count exactly once',async()=>{
  const {service,batteries,sessions}=fixture();
  await service.swap(staff,{vehicleId:12,replacementBatteryId:2,note:'Bắt đầu sạc'});
  const charged=await service.completeCharging(staff,1,{note:'Sạc đầy'});
  assert.equal(charged.status,BatteryStatus.FULL);
  assert.equal(charged.cycleCount,11);
  assert.ok(charged.lastChargedAt);
  assert.equal(sessions[0].completedById,staff.sub);
  assert.equal(sessions[0].completionNote,'Sạc đầy');
  assert.ok(sessions[0].completedAt);
  await assert.rejects(()=>service.completeCharging(staff,1,{}),/đang sạc/);
  assert.equal(batteries[0].cycleCount,11);
});

test('battery lifecycle allows maintenance and retirement but rejects invalid direct transitions',async()=>{
  const {service,batteries}=fixture();
  await assert.rejects(()=>service.updateStatus(staff,2,{status:'CHARGING'}),/Không thể chuyển trạng thái/);
  const maintenance=await service.updateStatus(staff,2,{status:'MAINTENANCE',note:'Kiểm tra định kỳ'});
  assert.equal(maintenance.status,BatteryStatus.MAINTENANCE);
  const restored=await service.updateStatus(staff,2,{status:'FULL',note:'Đã kiểm tra đạt'});
  assert.equal(restored.status,BatteryStatus.FULL);
  const retired=await service.updateStatus(staff,2,{status:'RETIRED',note:'Pin chai'});
  assert.equal(retired.status,BatteryStatus.RETIRED);
  assert.equal(batteries[1].cycleCount,4);
});

test('moving a charging battery to maintenance closes its session without adding a charge cycle',async()=>{
  const {service,batteries,sessions}=fixture();
  await service.swap(staff,{vehicleId:12,replacementBatteryId:2});
  const result=await service.updateStatus(staff,1,{status:'MAINTENANCE',note:'Sạc bất thường'});
  assert.equal(result.status,BatteryStatus.MAINTENANCE);
  assert.equal(batteries[0].cycleCount,10);
  assert.ok(sessions[0].completedAt);
  assert.equal(sessions[0].completedById,staff.sub);
});

test('battery health can be updated while in station custody and is rejected while installed',async()=>{
  const {service,batteries}=fixture();
  const updated=await service.updateHealth(staff,2,{healthPercent:87,note:'Đo kiểm tại trạm'});
  assert.equal(updated.healthPercent,87);
  assert.equal(updated.note,'Đo kiểm tại trạm');
  await assert.rejects(()=>service.updateHealth(staff,1,{healthPercent:70}),/Chỉ cập nhật sức khỏe pin/);
});

test('battery health update is restricted to assigned station',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.updateHealth({...staff,stationId:9},2,{healthPercent:80}),/ngoài trạm được phân công/);
});
