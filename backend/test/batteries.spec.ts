import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { Battery, BatteryStatus } from '../src/modules/batteries/battery.entity';
import { BatterySwap } from '../src/modules/batteries/battery-swap.entity';
import { BatteryReservation } from '../src/modules/batteries/battery-reservation.entity';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';
import { Role } from '../src/common/enums/role.enum';

function fixture(){
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
    save:async(value:any)=>value,
    count:async()=>2,
  };
  const swapRepo:any={create:(value:any)=>value,save:async(value:any)=>{const saved={...value,id:swaps.length+1};swaps.push(saved);return saved;}};
  const vehicleRepo:any={findOne:async()=>vehicle};
  const reservationQuery:any={where:()=>reservationQuery,andWhere:()=>reservationQuery,getCount:async()=>0,update:()=>({set:()=>({where:()=>({execute:async()=>({})})})}),select:()=>({addSelect:()=>({where:()=>({andWhere:()=>({andWhere:()=>({groupBy:()=>({getRawMany:async()=>[]})})})})})})};
  const reservationRepo:any={findOne:async()=>null,create:(value:any)=>value,save:async(value:any)=>value,createQueryBuilder:()=>reservationQuery};
  const stationRepo:any={findOne:async()=>({id:2,isActive:true})};
  const manager:any={getRepository:(entity:any)=>entity===Battery?batteryRepo:entity===BatterySwap?swapRepo:entity===BatteryReservation?reservationRepo:entity===Vehicle?vehicleRepo:stationRepo};
  const dataSource:any={transaction:async(fn:any)=>fn(manager)};
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


test('swap history returns paginated records with selected staff identity and filters',async()=>{
  const conditions:any[]=[];
  const records:any[]=[{id:7,performedBy:{id:5,fullName:'Staff A'}}];
  const qb:any={
    leftJoinAndSelect:()=>qb,leftJoin:()=>qb,addSelect:()=>qb,orderBy:()=>qb,addOrderBy:()=>qb,
    andWhere:(sql:string,params:any)=>{conditions.push({sql,params});return qb;},
    skip:(value:number)=>{qb.offset=value;return qb;},take:(value:number)=>{qb.limit=value;return qb;},
    getManyAndCount:async()=>[records,1],
  };
  const swaps:any={createQueryBuilder:()=>qb};
  const service=new BatteriesService({} as any,{} as any,swaps,{} as any,{} as any,{} as any);
  const result=await service.history(staff,{stationId:2,vehicleId:12,serial:'BAT',from:'2026-11-01',to:'2026-11-15',page:2,limit:10});
  assert.equal(result.total,1);
  assert.equal(result.page,2);
  assert.equal(result.items[0].performedBy.fullName,'Staff A');
  assert.equal(qb.offset,10);
  assert.equal(qb.limit,10);
  assert.equal(conditions.length,5);
  assert.equal(conditions[0].params.stationId,2);
  assert.equal(conditions[1].params.vehicleId,12);
  assert.equal(conditions.find(x=>x.params.serial)?.params.serial,'%BAT%');
});

test('swap history rejects staff station scope tampering',async()=>{
  const qb:any={leftJoinAndSelect:()=>qb,leftJoin:()=>qb,addSelect:()=>qb,orderBy:()=>qb,addOrderBy:()=>qb,andWhere:()=>qb,skip:()=>qb,take:()=>qb,getManyAndCount:async()=>[[],0]};
  const service=new BatteriesService({} as any,{} as any,{createQueryBuilder:()=>qb} as any,{} as any,{} as any,{} as any);
  await assert.rejects(()=>service.history({...staff,stationId:9},{stationId:2}),/ngoài trạm được phân công/);
});
