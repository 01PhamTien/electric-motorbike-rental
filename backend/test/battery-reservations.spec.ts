import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { BatteryReservation, BatteryReservationStatus } from '../src/modules/batteries/battery-reservation.entity';
import { Battery, BatteryStatus } from '../src/modules/batteries/battery.entity';
import { BatterySwap } from '../src/modules/batteries/battery-swap.entity';
import { Station } from '../src/modules/stations/station.entity';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';
import { Booking } from '../src/modules/bookings/booking.entity';
import { User } from '../src/modules/users/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { BookingStatus } from '../src/common/enums/booking-status.enum';

function expiryService(rows:any[]) {
  const calls:any[]=[];
  const repo:any={
    createQueryBuilder:()=>{
      const query:any={
        update:()=>query,
        set:(value:any)=>{query.updateValue=value;return query;},
        where:(condition:string,parameters:any)=>{query.condition=condition;query.parameters=parameters;return query;},
        execute:async()=>{
          calls.push({condition:query.condition,parameters:query.parameters,updateValue:query.updateValue});
          let affected=0;
          for(const row of rows){
            if(row.status===query.parameters.status&&row.expiresAt<=query.parameters.now){
              row.status=query.updateValue.status;
              affected++;
            }
          }
          return {affected};
        },
      };
      return query;
    },
    find:async()=>rows,
  };
  const service:any=Object.create(BatteriesService.prototype);
  service.reservations=repo;
  return {service,calls,rows};
}

test('lazy expiry marks only elapsed RESERVED holds as EXPIRED',async()=>{
  const now=new Date('2026-11-15T12:00:00.000Z');
  const rows=[
    {id:1,status:BatteryReservationStatus.RESERVED,expiresAt:new Date(now.getTime()-1)},
    {id:2,status:BatteryReservationStatus.RESERVED,expiresAt:new Date(now.getTime()+60_000)},
    {id:3,status:BatteryReservationStatus.REDEEMED,expiresAt:new Date(now.getTime()-60_000)},
  ];
  const {service,calls}=expiryService(rows);
  assert.equal(await service.expireReservations(now),1);
  assert.equal(rows[0].status,BatteryReservationStatus.EXPIRED);
  assert.equal(rows[1].status,BatteryReservationStatus.RESERVED);
  assert.equal(rows[2].status,BatteryReservationStatus.REDEEMED);
  assert.match(calls[0].condition,/expiresAt <= :now/);
});

test('customer reservation history lazily expires stale holds before reading',async()=>{
  const rows=[{id:8,customerId:42,status:BatteryReservationStatus.RESERVED,expiresAt:new Date(Date.now()-1000)}];
  const {service}=expiryService(rows);
  const result=await service.myReservations({sub:42});
  assert.equal(result.length,1);
  assert.equal(result[0].status,BatteryReservationStatus.EXPIRED);
});

test('reservation expiry is idempotent when called repeatedly',async()=>{
  const rows=[{id:9,status:BatteryReservationStatus.RESERVED,expiresAt:new Date(Date.now()-1000)}];
  const {service}=expiryService(rows);
  assert.equal(await service.expireReservations(),1);
  assert.equal(await service.expireReservations(),0);
});

test('reservation TTL defaults to ten minutes and accepts configured values',()=>{
  const service:any=Object.create(BatteriesService.prototype);
  const original=process.env.BATTERY_RESERVATION_TTL_MINUTES;
  try{
    delete process.env.BATTERY_RESERVATION_TTL_MINUTES;
    assert.equal(service.reservationTtlMinutes(),10);
    process.env.BATTERY_RESERVATION_TTL_MINUTES='15';
    assert.equal(service.reservationTtlMinutes(),15);
    process.env.BATTERY_RESERVATION_TTL_MINUTES='0';
    assert.throws(()=>service.reservationTtlMinutes(),/between 1 and 120/);
  }finally{
    if(original===undefined)delete process.env.BATTERY_RESERVATION_TTL_MINUTES;
    else process.env.BATTERY_RESERVATION_TTL_MINUTES=original;
  }
});

test('concurrent customers cannot reserve more holds than the last available battery',async()=>{
  const reservations:any[]=[];
  let stationQueue=Promise.resolve();
  const acquireStation=async()=>{
    const previous=stationQueue;
    let release!:()=>void;
    stationQueue=new Promise<void>(resolve=>{release=resolve;});
    await previous;
    return release;
  };
  const batteryRepo:any={count:async()=>1};
  const swapRepo:any={};
  const reservationRepo:any={
    create:(value:any)=>value,
    save:async(value:any)=>{const saved={...value,id:reservations.length+1};reservations.push(saved);return saved;},
    findOne:async({where}:any)=>reservations.find(row=>Object.entries(where).every(([key,value])=>(row as any)[key]===value))??null,
    createQueryBuilder:(alias?:string)=>{
      if(alias){
        let stationId:number|undefined;
        return {
          where:(_sql:string,params:any)=>{stationId=params.stationId;return this;},
          andWhere:()=>this,
          getCount:async()=>reservations.filter(r=>r.stationId===stationId&&r.status===BatteryReservationStatus.RESERVED&&r.expiresAt>new Date()).length,
        };
      }
      const builder:any={
        update:()=>builder,set:()=>builder,where:()=>builder,
        execute:async()=>{
          for(const row of reservations)if(row.status===BatteryReservationStatus.RESERVED&&row.expiresAt<=new Date())row.status=BatteryReservationStatus.EXPIRED;
          return {affected:0};
        },
      };
      return builder;
    },
  };
  const userRepo:any={findOne:async({where}:any)=>({id:where.id})};
  const bookingRepo:any={findOne:async({where}:any)=>({
    id:where.id,customerId:where.customerId,vehicleId:12,status:BookingStatus.RENTING,
    vehicle:{id:12,stationId:2,isActive:true},
  })};
  const station={id:2,isActive:true};
  const dataSource:any={
    transaction:async(fn:any)=>{
      let release:(()=>void)|undefined;
      const txStationRepo:any={findOne:async()=>{release=await acquireStation();return station;}};
      const manager:any={getRepository:(entity:any)=>entity===Battery?batteryRepo:entity===BatterySwap?swapRepo:
        entity===BatteryReservation?reservationRepo:entity===Station?txStationRepo:
        entity===Booking?bookingRepo:entity===User?userRepo:entity===Vehicle?{}:{}};
      try{return await fn(manager);}finally{release?.();}
    },
  };
  const service=new BatteriesService(dataSource,batteryRepo,swapRepo,reservationRepo,{} as any,{} as any);
  const customer=(id:number)=>({sub:id,email:`customer${id}@example.test`,role:Role.CUSTOMER,stationId:null});
  const attempts=await Promise.allSettled([
    service.reserve(customer(101),{stationId:2,bookingId:501}),
    service.reserve(customer(102),{stationId:2,bookingId:502}),
  ]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(attempts.filter(x=>x.status==='rejected').length,1);
  assert.equal(reservations.filter(r=>r.status===BatteryReservationStatus.RESERVED).length,1);
});
