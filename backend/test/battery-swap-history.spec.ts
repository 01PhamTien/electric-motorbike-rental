import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteriesService } from '../src/modules/batteries/batteries.service';
import { Role } from '../src/common/enums/role.enum';

function fixture(rows:any[] = []) {
  const calls:any[]=[];
  const qb:any={
    leftJoinAndSelect:(...args:any[])=>{calls.push(['join',...args]);return qb;},
    leftJoin:(...args:any[])=>{calls.push(['leftJoin',...args]);return qb;},
    addSelect:(...args:any[])=>{calls.push(['addSelect',...args]);return qb;},
    orderBy:(...args:any[])=>{calls.push(['orderBy',...args]);return qb;},
    addOrderBy:(...args:any[])=>{calls.push(['addOrderBy',...args]);return qb;},
    andWhere:(...args:any[])=>{calls.push(['where',...args]);return qb;},
    skip:(...args:any[])=>{calls.push(['skip',...args]);return qb;},
    take:(...args:any[])=>{calls.push(['take',...args]);return qb;},
    getManyAndCount:async()=>[rows,27],
  };
  const swaps:any={createQueryBuilder:()=>qb};
  const service=new BatteriesService({} as any,{} as any,swaps,{} as any,{} as any,{} as any);
  return {service,calls};
}
const staff={sub:5,email:'staff@example.test',role:Role.STAFF,stationId:2};
const admin={sub:1,email:'admin@example.test',role:Role.ADMIN,stationId:null};

test('swap history scopes unassigned STAFF to empty results',async()=>{
  const {service,calls}=fixture();
  const result=await service.history({...staff,stationId:null},{});
  assert.deepEqual(result,{items:[],total:0,page:1,limit:20,totalPages:0});
  assert.equal(calls.length,0);
});

test('swap history filters serial, vehicle, dates and paginates',async()=>{
  const {service,calls}=fixture([{id:1}]);
  const result=await service.history(staff,{vehicleId:12,serial:' BAT- ',from:'2026-11-01',to:'2026-11-15',page:2,limit:200});
  assert.equal(result.total,27);
  assert.equal(result.page,2);
  assert.equal(result.limit,100);
  assert.equal(result.totalPages,1);
  assert.ok(calls.some(c=>c[0]==='where'&&String(c[1]).includes('swap.stationId')));
  assert.ok(calls.some(c=>c[0]==='where'&&String(c[1]).includes('swap.vehicleId')));
  assert.ok(calls.some(c=>c[0]==='where'&&String(c[1]).includes('removedBattery.serialNumber')));
  const to=calls.find(c=>c[0]==='where'&&String(c[1]).includes('swap.createdAt <='));
  assert.equal(to[2].toDate.toISOString(),'2026-11-15T23:59:59.999Z');
  assert.ok(calls.some(c=>c[0]==='leftJoin'&&c[1]==='swap.performedBy'));
  assert.ok(calls.some(c=>c[0]==='skip'&&c[1]===100));
  assert.ok(calls.some(c=>c[0]==='take'&&c[1]===100));
});

test('swap history rejects reversed date ranges',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.history(admin,{from:'2026-11-16',to:'2026-11-15'}),/Ngày bắt đầu/);
});

test('swap history rejects explicit station outside STAFF assignment',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.history(staff,{stationId:9}),/ngoài trạm được phân công/);
});
