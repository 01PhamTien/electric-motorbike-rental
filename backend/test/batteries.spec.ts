import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { Battery, BatteryStatus } from '../src/modules/batteries/battery.entity';
import { BatterySwap } from '../src/modules/batteries/battery-swap.entity';
import { BatteryReservation } from '../src/modules/batteries/battery-reservation.entity';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';
import { Role } from '../src/common/enums/role.enum';

function fixture(options:any={}){
  const vehicle:any={id:12,code:'VG-12',stationId:2,isActive:true};
  const removed:any={id:1,serialNumber:'BAT-OLD',stationId:2,vehicleId:12,status:BatteryStatus.INSTALLED,cycleCount:10};
  const replacement:any={id:2,serialNumber:'BAT-FULL',stationId:2,vehicleId:null,status:BatteryStatus.FULL,cycleCount:4};
  const batteries=[removed,replacement],swaps:any[]=[];
  const batteryRepo:any={
    findOne:async({where}:any)=>{
      if(where.id!==undefined)return batteries.find(b=>b.id===where.id)??null;
      if(where.vehicleId!==undefined)return batteries.find(b=>b.vehicleId===where.vehicleId&&b.status===where.status)??null;
      return null;
    },
    save:async(value:any)=>{if(options.failBatterySaveForId===value.id)throw new Error('simulated battery write failure');return value;},
    count:async()=>2,
  };
  const swapRepo:any={create:(value:any)=>value,save:async(value:any)=>{if(options.failSwapSave)throw new Error('simulated swap history failure');const saved={...value,id:swaps.length+1};swaps.push(saved);return saved;}};
  const vehicleRepo:any={findOne:async()=>vehicle};
  const reservationQuery:any={where:()=>reservationQuery,andWhere:()=>reservationQuery,getCount:async()=>0,update:()=>({set:()=>({where:()=>({execute:async()=>({})})})}),select:()=>({addSelect:()=>({where:()=>({andWhere:()=>({andWhere:()=>({groupBy:()=>({getRawMany:async()=>[]})})})})})})};
  const reservationRepo:any={findOne:async()=>null,create:(value:any)=>value,save:async(value:any)=>value,createQueryBuilder:()=>reservationQuery};
  const stationRepo:any={findOne:async()=>({id:2,isActive:true})};
  const manager:any={getRepository:(entity:any)=>entity===Battery?batteryRepo:entity===BatterySwap?swapRepo:entity===BatteryReservation?reservationRepo:entity===Vehicle?vehicleRepo:stationRepo};
  const dataSource:any={transaction:async(fn:any)=>{
    const beforeBatteries=batteries.map(b=>({...b})),beforeSwaps=swaps.slice();
    try{return await fn(manager);}catch(error){
      batteries.forEach((b,i)=>{for(const key of Object.keys(b))delete b[key];Object.assign(b,beforeBatteries[i]);});
      swaps.splice(0,swaps.length,...beforeSwaps);
      throw error;
    }
  }};
  const service=new BatteriesService(dataSource,batteryRepo,swapRepo,reservationRepo,stationRepo,vehicleRepo);
  return {service,batteries,swaps,vehicle};
}
const staff={sub:5,email:'staff@example.test',role:Role.STAFF,stationId:2};

test('battery swap atomically installs full battery and sends removed battery to charging',async()=>{
  const {service,batteries,swaps}=fixture();
  const result=await service.swap(staff,{vehicleId:12,replacementBatteryId:2,note:'Khách cần đi ngay'});
  assert.equal(result.removedBattery.status,BatteryStatus.CHARGING);
  assert.equal(result.removedBattery.vehicleId,null);
  assert.equal(result.installedBattery.status,BatteryStatus.INSTALLED);
  assert.equal(result.installedBattery.vehicleId,12);
  assert.equal(swaps.length,1);
  assert.equal(swaps[0].removedBatteryId,1);
  assert.equal(swaps[0].installedBatteryId,2);
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

test('install rejects a battery whose station differs from the vehicle station',async()=>{
  const {service,batteries}=fixture();
  batteries[1].stationId=9;
  await assert.rejects(()=>service.install(staff,{vehicleId:12,batteryId:2}),/cùng một trạm/);
  assert.equal(batteries[1].status,BatteryStatus.FULL);
  assert.equal(batteries[1].vehicleId,null);
});

test('install rejects a vehicle outside the staff assigned station',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.install({...staff,stationId:9},{vehicleId:12,batteryId:2}),/ngoài trạm được phân công/);
});

test('swap rejects an installed battery whose station does not match the vehicle station',async()=>{
  const {service,batteries,swaps}=fixture();
  batteries[0].stationId=9;
  await assert.rejects(()=>service.swap(staff,{vehicleId:12,replacementBatteryId:2}),/không thuộc trạm hiện tại/);
  assert.equal(batteries[0].status,BatteryStatus.INSTALLED);
  assert.equal(batteries[1].status,BatteryStatus.FULL);
  assert.equal(swaps.length,0);
});

test('swap transaction rolls back battery changes if swap history insert fails',async()=>{
  const {service,batteries,swaps}=fixture({failSwapSave:true});
  await assert.rejects(()=>service.swap(staff,{vehicleId:12,replacementBatteryId:2}),/simulated swap history failure/);
  assert.equal(batteries[0].status,BatteryStatus.INSTALLED);
  assert.equal(batteries[0].vehicleId,12);
  assert.equal(batteries[1].status,BatteryStatus.FULL);
  assert.equal(batteries[1].vehicleId,null);
  assert.equal(swaps.length,0);
});

test('swap rejects replacement battery that is already charging',async()=>{
  const {service,batteries}=fixture();
  batteries[1].status=BatteryStatus.CHARGING;
  await assert.rejects(()=>service.swap(staff,{vehicleId:12,replacementBatteryId:2}),/Pin thay thế phải ở trạng thái đầy/);
});

test('STAFF cannot request battery history from another station',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.history({...staff,stationId:9},9),/ngoài trạm được phân công/);
});
