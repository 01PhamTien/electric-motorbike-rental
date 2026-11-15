import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { BatteryReservationStatus } from '../src/modules/batteries/battery-reservation.entity';

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
