import 'reflect-metadata';
import assert = require('node:assert/strict');
import { test } from 'node:test';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { PaymentPurpose } from '../src/modules/payments/payment.entity';
import { ReportsService } from '../src/modules/reports/reports.service';

function fixture() {
  const bookings = [
    { id:1, status:BookingStatus.COMPLETED, createdAt:new Date('2026-11-02T10:00:00Z'), rentalAmount:'300000.00', vehicle:{id:10,code:'VG-10',model:{name:'City'},station:{id:2,name:'Hai Chau'}} },
    { id:2, status:BookingStatus.RENTING, createdAt:new Date('2026-11-03T10:00:00Z'), rentalAmount:'200000.00', vehicle:{id:11,code:'VG-11',model:{name:'Go'},station:{id:2,name:'Hai Chau'}} },
    { id:3, status:BookingStatus.CANCELLED, createdAt:new Date('2026-11-04T10:00:00Z'), rentalAmount:'100000.00', vehicle:{id:10,code:'VG-10',model:{name:'City'},station:{id:2,name:'Hai Chau'}} },
  ];
  const payments = [
    {purpose:PaymentPurpose.RENT,amount:'300000.00',createdAt:new Date('2026-11-02T11:00:00Z')},
    {purpose:PaymentPurpose.EXTRA,amount:'20000.00',createdAt:new Date('2026-11-02T12:00:00Z')},
    {purpose:PaymentPurpose.DEPOSIT,amount:'500000.00',createdAt:new Date('2026-11-02T11:00:00Z')},
    {purpose:PaymentPurpose.REFUND,amount:'100000.00',createdAt:new Date('2026-11-04T12:00:00Z')},
  ];
  const qb = (rows:any[]) => ({
    andWhere() { return this; },
    leftJoinAndSelect() { return this; },
    getMany: async () => rows,
  });
  const bookingRepo = { createQueryBuilder: () => qb(bookings) };
  const paymentRepo = {
    createQueryBuilder: () => qb(payments),
    find: async () => payments,
  };
  const vehicleRepo = { count: async ({where}:any) => where?.status === 'ACTIVE' ? 8 : where?.status === 'MAINTENANCE' ? 1 : where?.isActive === false ? 1 : 10 };
  return new ReportsService(bookingRepo as never,vehicleRepo as never,paymentRepo as never);
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

test('report rejects invalid and reversed date ranges', async () => {
  await assert.rejects(()=>fixture().getOverview('not-a-date'),/from không hợp lệ/);
  await assert.rejects(()=>fixture().getOverview('2026-12-01','2026-11-01'),/from phải nhỏ hơn/);
});
