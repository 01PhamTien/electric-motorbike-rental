import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { Role } from '../src/common/enums/role.enum';
import { OperatingCostsService } from '../src/modules/operating-costs/operating-costs.service';
import { OperatingCostCategory } from '../src/modules/operating-costs/operating-cost.entity';

function fixture() {
  const saved:any[]=[];
  const costRepo={
    create:(value:any)=>value,
    save:async(value:any)=>{saved.push(value);return {...value,id:saved.length};},
    createQueryBuilder:()=>({leftJoinAndSelect(){return this;},orderBy(){return this;},take(){return this;},andWhere(){return this;},getMany:async()=>saved}),
  };
  const stationRepo={findOne:async()=>({id:2,name:'Hai Chau',isActive:true})};
  const vehicleRepo={findOne:async({where}:any)=>where.id===10?({id:10,code:'VG-10',stationId:2}):({id:11,code:'VG-11',stationId:3})};
  return {service:new OperatingCostsService(costRepo as never,vehicleRepo as never,stationRepo as never),saved};
}
const admin={sub:1,email:'admin@example.test',role:Role.ADMIN,stationId:null};
const staff={sub:2,email:'staff@example.test',role:Role.STAFF,stationId:2};

test('charging expense requires a vehicle',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.create(admin,{
    stationId:2,category:OperatingCostCategory.CHARGING,amount:30000,occurredAt:'2026-11-05T08:00:00Z',
  }),/phải gắn với một xe/);
});

test('vehicle expense must be recorded at its current station',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.create(admin,{
    stationId:2,vehicleId:11,category:OperatingCostCategory.CLEANING,amount:20000,occurredAt:'2026-11-05T08:00:00Z',
  }),/phải trùng với trạm hiện tại/);
});

test('staff can record a charging expense only for their assigned station',async()=>{
  const {service,saved}=fixture();
  const record=await service.create(staff,{
    stationId:2,vehicleId:10,category:OperatingCostCategory.CHARGING,amount:30000,
    energyKwh:12.5,unitPrice:2400,occurredAt:'2026-11-05T08:00:00Z',note:'Sạc sau khi trả xe',
  });
  assert.equal(record.stationId,2);
  assert.equal(record.vehicleId,10);
  assert.equal(record.energyKwh,'12.5');
  assert.equal(saved.length,1);
});

test('staff cannot record costs for another station',async()=>{
  const {service}=fixture();
  await assert.rejects(()=>service.create({...staff,stationId:3},{
    stationId:2,category:OperatingCostCategory.CLEANING,amount:20000,occurredAt:'2026-11-05T08:00:00Z',
  }),/ngoài trạm được phân công/);
});
