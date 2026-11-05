import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { PaymentPurpose } from '../src/modules/payments/payment.entity';
import { OperatingCostCategory } from '../src/modules/operating-costs/operating-cost.entity';
import { ReportsService } from '../src/modules/reports/reports.service';

function fixture() {
  const bookings = [
    { id:1, status:BookingStatus.COMPLETED, createdAt:new Date('2026-11-02T10:00:00Z'), pickupAt:new Date('2026-11-02T10:00:00Z'), returnAt:new Date('2026-11-03T10:00:00Z'), rentalAmount:'300000.00', customer:{id:101,role:'CUSTOMER',fullName:'Nguyen A',createdAt:new Date('2026-10-01T00:00:00Z')}, vehicle:{id:10,code:'VG-10',model:{name:'City'},station:{id:2,name:'Hai Chau'}} },
    { id:2, status:BookingStatus.RENTING, createdAt:new Date('2026-11-03T10:00:00Z'), pickupAt:new Date('2026-11-04T10:00:00Z'), returnAt:new Date('2026-11-05T10:00:00Z'), rentalAmount:'200000.00', customer:{id:101,role:'CUSTOMER',fullName:'Nguyen A',createdAt:new Date('2026-10-01T00:00:00Z')}, vehicle:{id:11,code:'VG-11',model:{name:'Go'},station:{id:2,name:'Hai Chau'}} },
    { id:3, status:BookingStatus.CANCELLED, createdAt:new Date('2026-11-04T10:00:00Z'), pickupAt:new Date('2026-11-06T10:00:00Z'), returnAt:new Date('2026-11-07T10:00:00Z'), rentalAmount:'100000.00', customer:{id:102,role:'CUSTOMER',fullName:'Tran B',createdAt:new Date('2026-11-02T00:00:00Z')}, vehicle:{id:10,code:'VG-10',model:{name:'City'},station:{id:2,name:'Hai Chau'}} },
  ];
  const operatingCosts = [
    {stationId:2,station:{id:2,name:'Hai Chau'},vehicleId:10,vehicle:{id:10,code:'VG-10'},category:OperatingCostCategory.CHARGING,amount:'30000.00',energyKwh:'12.500'},
    {stationId:2,station:{id:2,name:'Hai Chau'},vehicleId:11,vehicle:{id:11,code:'VG-11'},category:OperatingCostCategory.CLEANING,amount:'15000.00',energyKwh:null},
  ];
  const maintenance = [
    {vehicleId:10,status:'COMPLETED',cost:'75000.00',completedAt:new Date('2026-11-05T10:00:00Z')},
    {vehicleId:11,status:'COMPLETED',cost:'25000.00',completedAt:new Date('2026-11-06T10:00:00Z')},
  ];
  const payments = [
    {purpose:PaymentPurpose.RENT,amount:'300000.00',createdAt:new Date('2026-11-02T11:00:00Z')},
    {purpose:PaymentPurpose.EXTRA,amount:'20000.00',createdAt:new Date('2026-11-02T12:00:00Z')},
    {purpose:PaymentPurpose.DEPOSIT,amount:'500000.00',createdAt:new Date('2026-11-02T11:00:00Z')},
    {purpose:PaymentPurpose.REFUND,amount:'100000.00',createdAt:new Date('2026-11-04T12:00:00Z')},
  ];
  const qb = (rows:any[]) => ({
    where() { return this; },
    andWhere() { return this; },
    leftJoinAndSelect() { return this; },
    getMany: async () => rows,
  });
  const bookingRepo = { createQueryBuilder: () => qb(bookings) };
  const paymentRepo = {
    createQueryBuilder: () => qb(payments),
    find: async () => payments,
  };
  const vehicleRepo = {
    count: async ({where}:any = {}) => where?.status === 'ACTIVE' ? 8 : where?.status === 'MAINTENANCE' ? 1 : where?.isActive === false ? 1 : 10,
    find: async () => [{id:10,code:'VG-10',station:{name:'Hai Chau'}},{id:11,code:'VG-11',station:{name:'Hai Chau'}},{id:12,code:'VG-12',station:{name:'Hai Chau'}}],
  };
  const maintenanceRepo = { createQueryBuilder: () => qb(maintenance) };
  const operatingCostRepo = { createQueryBuilder: () => qb(operatingCosts) };
  return new ReportsService(bookingRepo as never,vehicleRepo as never,paymentRepo as never,maintenanceRepo as never,operatingCostRepo as never);
}

test('report separates collected rent and extras from deposits and refunds', async () => {
  const report=await fixture().getOverview('2026-11-01','2026-11-30');
  assert.equal(report.finance.rentCollected,300000);
  assert.equal(report.finance.extrasCollected,20000);
  assert.equal(report.finance.recognizedRevenue,320000);
  assert.equal(report.finance.refunds,100000);
  assert.equal(report.finance.netCashIn,220000);
  assert.equal(report.finance.depositHeldNow,400000);
});

test('report calculates station and vehicle performance from booking records', async () => {
  const report=await fixture().getOverview();
  assert.equal(report.bookings.total,3);
  assert.equal(report.bookings.byStatus[BookingStatus.COMPLETED],1);
  assert.equal(report.stations[0].bookings,3);
  assert.equal(report.topVehicles[0].code,'VG-10');
  assert.equal(report.topVehicles[0].bookings,2);
});

test('report distinguishes new and repeat customers and ranks top customers', async () => {
  const report=await fixture().getOverview('2026-11-01','2026-11-30');
  assert.equal(report.customers.uniqueInPeriod,2);
  assert.equal(report.customers.newInPeriod,1);
  assert.equal(report.customers.returningInPeriod,1);
  assert.equal(report.customers.topCustomers[0].name,'Nguyen A');
  assert.equal(report.customers.topCustomers[0].bookings,2);
});
test('report totals completed maintenance cost and ranks per-vehicle expenses', async () => {
  const report=await fixture().getOverview('2026-11-01','2026-11-30');
  assert.equal(report.maintenance.completedRecords,2);
  assert.equal(report.maintenance.recordedCost,100000);
  assert.equal(report.maintenance.byVehicle[0].code,'VG-10');
  assert.equal(report.maintenance.byVehicle[0].recordedCost,75000);
});
test('report calculates fleet utilization from rental overlap, excluding cancelled bookings', async () => {
  const report=await fixture().getOverview('2026-11-01','2026-11-11');
  assert.equal(report.fleetUtilization.activeFleetCount,8);
  assert.equal(report.fleetUtilization.periodDays,11);
  assert.equal(report.fleetUtilization.bookedVehicleDays,2);
  assert.equal(report.fleetUtilization.utilizationRate,2.27);
  assert.equal(report.fleetUtilization.idleFleetDays,86);
  assert.equal(report.fleetUtilization.byVehicle[0].code,'VG-10');
  assert.equal(report.fleetUtilization.byVehicle.find(v=>v.code==='VG-12')?.bookedDays,0);
  assert.equal(report.fleetUtilization.byVehicle.find(v=>v.code==='VG-12')?.idleDays,11);
});
test('report aggregates operating costs by category, vehicle and station', async () => {
  const report=await fixture().getOverview('2026-11-01','2026-11-30');
  assert.equal(report.operatingCosts.totalCost,45000);
  assert.equal(report.operatingCosts.chargingKwh,12.5);
  assert.equal(report.operatingCosts.records,2);
  assert.equal(report.operatingCosts.byVehicle[0].code,'VG-10');
  assert.equal(report.operatingCosts.byVehicle[0].amount,30000);
  assert.equal(report.operatingCosts.byStation[0].name,'Hai Chau');
  assert.equal(report.operatingCosts.trackedCostTotal,145000);
  assert.equal(report.operatingCosts.contributionAfterTrackedCosts,175000);
});
test('report rejects invalid and reversed date ranges', async () => {
  await assert.rejects(()=>fixture().getOverview('not-a-date'),/from không hợp lệ/);
  await assert.rejects(()=>fixture().getOverview('2026-12-01','2026-11-01'),/from phải nhỏ hơn/);
});
