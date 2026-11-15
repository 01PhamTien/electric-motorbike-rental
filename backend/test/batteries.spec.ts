import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { Battery, BatteryStatus } from '../src/modules/batteries/battery.entity';
import { BatterySwap } from '../src/modules/batteries/battery-swap.entity';
import { BatteryReservation } from '../src/modules/batteries/battery-reservation.entity';
import { BatteryChargingSession, BatteryChargingStatus } from '../src/modules/batteries/battery-charging-session.entity';
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
  const vehicleRepo:any={findOne:async()=>vehicle};
  const reservationQuery:any={where:()=>reservationQuery,andWhere:()=>reservationQuery,getCount:async()=>0,update:()=>({set:()=>({where:()=>({execute:async()=>({})})})}),select:()=>({addSelect:()=>({where:()=>({andWhere:()=>({andWhere:()=>({groupBy:()=>({getRawMany:async()=>[]})})})})})})};
  const reservationRepo:any={findOne:async()=>null,create:(value:any)=>value,save:async(value:any)=>value,createQueryBuilder:()=>reservationQuery};
  const chargingRepo:any={
    create:(value:any)=>value,
    save:async(value:any)=>{const saved={...value,id:sessions.length+1};sessions.push(saved);return saved;},
    findOne:async({where}:any)=>sessions.find(s=>s.batteryId===where.batteryId&&s.status===where.status)??null,
  };
  const stationRepo:any={findOne:async()=>({id:2,isActive:true})};
  const manager:any={getRepository:(entity:any)=>entity===Battery?batteryRepo:entity===BatterySwap?swapRepo:entity===BatteryReservation?reservationRepo:entity===BatteryChargingSession?chargingRepo:entity===Vehicle?vehicleRepo:stationRepo};
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
  assert.equal(sessions[0].status,BatteryChargingStatus.IN_PROGRESS);
  assert.equal(sessions[0].batteryId,1);
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

test('charging completion closes the active session and increments cycle exactly once',async()=>{
  const {service,batteries,sessions}=fixture();
  await service.swap(staff,{vehicleId:12,replacementBatteryId:2});
  const before=batteries[0].cycleCount;
  const result=await service.completeCharging(staff,1,91,'Đạt kiểm tra sau sạc');
  assert.equal(result.battery.status,BatteryStatus.FULL);
  assert.equal(result.battery.cycleCount,before+1);
  assert.equal(result.battery.healthPercent,91);
  assert.equal(result.session.status,BatteryChargingStatus.COMPLETED);
  assert.equal(result.session.completedById,staff.sub);
  await assert.rejects(()=>service.completeCharging(staff,1),/đang sạc/);
  assert.equal(batteries[0].cycleCount,before+1);
});

test('charging completion safely records legacy charging batteries without a session',async()=>{
  const {service,batteries,sessions}=fixture();
  batteries[0].status=BatteryStatus.CHARGING;batteries[0].vehicleId=null;
  const result=await service.completeCharging(staff,1);
  assert.equal(result.battery.status,BatteryStatus.FULL);
  assert.equal(result.battery.cycleCount,11);
  assert.equal(result.session.status,BatteryChargingStatus.COMPLETED);
  assert.match(result.session.note,/trước khi bật theo dõi/);
  assert.equal(sessions.length,1);
});

test('battery health update validates station scope and refuses retired batteries',async()=>{
  const {service,batteries}=fixture();
  const updated=await service.updateHealth(staff,1,78,'Kiểm tra định kỳ');
  assert.equal(updated.healthPercent,78);
  batteries[0].status=BatteryStatus.RETIRED;
  await assert.rejects(()=>service.updateHealth(staff,1,70),/đã ngừng sử dụng/);
});

test('maintenance can only start for an unassigned full battery and can be completed',async()=>{
  const {service,batteries}=fixture();
  const started=await service.setMaintenance(staff,2,'Kiểm tra đầu nối');
  assert.equal(started.status,BatteryStatus.MAINTENANCE);
  const completed=await service.completeMaintenance(staff,2,'Đã vệ sinh và kiểm tra');
  assert.equal(completed.status,BatteryStatus.FULL);
  batteries[0].status=BatteryStatus.INSTALLED;
  await assert.rejects(()=>service.setMaintenance(staff,1),/Chỉ pin đầy/);
});

test('retirement is allowed only for stock or maintenance batteries',async()=>{
  const {service,batteries}=fixture();
  const retired=await service.retireBattery(staff,2,'Đạt ngưỡng loại bỏ');
  assert.equal(retired.status,BatteryStatus.RETIRED);
  await assert.rejects(()=>service.retireBattery(staff,1),/Chỉ pin trong kho/);
});
