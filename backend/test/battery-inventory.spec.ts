import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { BatteryStatus } from '../src/modules/batteries/battery.entity';
import { Role } from '../src/common/enums/role.enum';

function fixture(rows:any[] = []) {
  const calls:any[]=[];
  const qb:any={
    leftJoinAndSelect:(...args:any[])=>{calls.push(['join',...args]);return qb;},
    innerJoin:(...args:any[])=>{calls.push(['innerJoin',...args]);return qb;},
    orderBy:(...args:any[])=>{calls.push(['orderBy',...args]);return qb;},
    addOrderBy:(...args:any[])=>{calls.push(['addOrderBy',...args]);return qb;},
    andWhere:(...args:any[])=>{calls.push(['where',...args]);return qb;},
    skip:(...args:any[])=>{calls.push(['skip',...args]);return qb;},
    take:(...args:any[])=>{calls.push(['take',...args]);return qb;},
    select:(...args:any[])=>{calls.push(['select',...args]);return qb;},
    addSelect:(...args:any[])=>{calls.push(['addSelect',...args]);return qb;},
    groupBy:(...args:any[])=>{calls.push(['groupBy',...args]);return qb;},
    addGroupBy:(...args:any[])=>{calls.push(['addGroupBy',...args]);return qb;},
    getManyAndCount:async()=>[rows,37],
    getRawMany:async()=>rows,
  };
  const batteryRepo:any={createQueryBuilder:()=>qb};
  const service=new BatteriesService({} as any,batteryRepo,{} as any,{} as any,{} as any,{} as any);
  return {service,calls};
}
const staff={sub:5,email:'staff@example.test',role:Role.STAFF,stationId:2};
const admin={sub:1,email:'admin@example.test',role:Role.ADMIN,stationId:null};

test('inventory scopes unassigned staff to an empty result without querying',async()=>{
  const {service,calls}=fixture();
  const result=await service.inventory({...staff,stationId:null},{});
  assert.deepEqual(result,{items:[],total:0,page:1,limit:20,totalPages:0});
  assert.equal(calls.length,0);
});

test('inventory enforces assigned station, filters and caps pagination',async()=>{
  const {service,calls}=fixture([{id:1}]);
  const result=await service.inventory(staff,{status:BatteryStatus.FULL,search:' BAT-1 ',page:2,limit:500});
  assert.equal(result.total,37);
  assert.equal(result.page,2);
  assert.equal(result.limit,100);
  assert.equal(result.totalPages,1);
  assert.ok(calls.some(c=>c[0]==='where'&&String(c[1]).includes('battery.stationId')));
  assert.ok(calls.some(c=>c[0]==='where'&&String(c[1]).includes('battery.status')));
  assert.ok(calls.some(c=>c[0]==='where'&&String(c[1]).includes('serialNumber')));
  assert.ok(calls.some(c=>c[0]==='skip'&&c[1]===100));
  assert.ok(calls.some(c=>c[0]==='take'&&c[1]===100));
});

test('inventory rejects an explicit station outside staff assignment',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.inventory(staff,{stationId:9}),/ngoài trạm được phân công/);
});

test('inventory summary includes every battery state including TRANSFERRING',async()=>{
  const rows=[
    {stationId:2,stationName:'Trạm A',status:'FULL',count:'3'},
    {stationId:2,stationName:'Trạm A',status:'TRANSFERRING',count:'2'},
  ];
  const {service}=fixture(rows);
  const result=await service.inventorySummary(admin);
  assert.equal(result.totals.total,5);
  assert.equal(result.totals.FULL,3);
  assert.equal(result.totals.TRANSFERRING,2);
  assert.equal(result.stations[0].total,5);
});
