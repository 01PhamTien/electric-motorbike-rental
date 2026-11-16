import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { Role } from '../src/common/enums/role.enum';
import { JwtUser } from '../src/common/interfaces/jwt-user.interface';
import { Booking } from '../src/modules/bookings/booking.entity';
import { BookingStatusHistory } from '../src/modules/bookings/booking-status-history.entity';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';

function setup(status: BookingStatus) {
  const booking: any = {
    id: 42,
    customerId: 7,
    vehicleId: 9,
    vehicle: { id: 9, stationId: 3 },
    status,
    pickupAt: new Date(Date.now() + 2 * 60 * 60_000),
    returnAt: new Date(Date.now() + 26 * 60 * 60_000),
    rentalAmount: '500000.00',
    depositSnapshot: '300000.00',
    cancellationFeeAmount: '0.00',
    cancellationType: null,
    cancelReason: null,
    holdExpiresAt: null,
  };
  const history: any[] = [];
  const bookingRepo = {
    findOne: async () => ({ id: booking.id, vehicleId: booking.vehicleId }),
  };
  const manager = {
    getRepository(entity: unknown) {
      if (entity === Vehicle) return { findOne: async () => ({ id: 9 }) };
      if (entity === Booking) return {
        findOne: async () => booking,
        save: async (value: any) => value,
      };
      if (entity === BookingStatusHistory) return {
        save: async (value: any) => { history.push(value); return value; },
      };
      throw new Error('Unexpected repository');
    },
  };
  const dataSource = {
    transaction: async (callback: (manager: any) => Promise<unknown>) => callback(manager),
  } as unknown as DataSource;
  const service = new BookingsService(dataSource, {} as ConfigService, bookingRepo as any);
  const customer: JwtUser = {
    sub: 7, email: 'customer@example.com', role: Role.CUSTOMER, stationId: null,
  };
  return { service, booking, history, customer };
}

test('confirmed customer cancellation inside 24 hours stores the late fee', async () => {
  const ctx = setup(BookingStatus.CONFIRMED);
  const result = await ctx.service.cancel(ctx.customer, 42, { reason: 'Thay đổi kế hoạch' });
  assert.equal(result.status, BookingStatus.CANCELLED);
  assert.equal(result.cancellationFeeAmount, '100000.00');
  assert.equal(result.cancellationType, 'CUSTOMER_CANCELLED');
  assert.equal(result.cancelReason, 'Thay đổi kế hoạch');
  assert.equal(ctx.history.length, 1);
  assert.equal(ctx.history[0].fromStatus, BookingStatus.CONFIRMED);
  assert.equal(ctx.history[0].toStatus, BookingStatus.CANCELLED);
});

test('pending customer cancellation remains free', async () => {
  const ctx = setup(BookingStatus.PENDING);
  const result = await ctx.service.cancel(ctx.customer, 42, { reason: 'Không còn nhu cầu' });
  assert.equal(result.status, BookingStatus.CANCELLED);
  assert.equal(result.cancellationFeeAmount, '0.00');
  assert.equal(ctx.history[0].fromStatus, BookingStatus.PENDING);
});
