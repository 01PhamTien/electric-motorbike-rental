import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DataSource } from 'typeorm';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { BookingExpiryService } from '../src/modules/bookings/booking-expiry.service';
import { Booking } from '../src/modules/bookings/booking.entity';
import { BookingStatusHistory } from '../src/modules/bookings/booking-status-history.entity';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';

function setup(status: BookingStatus = BookingStatus.PENDING, hasCandidate = true) {
  const history: Array<Record<string, unknown>> = [];
  const booking = {
    id: 42,
    vehicleId: 7,
    status,
    holdExpiresAt: new Date(Date.now() - 60_000),
  };
  let saves = 0;
  let transactions = 0;

  const bookingRepository = {
    find: async () => hasCandidate ? [{ id: 42, vehicleId: 7 }] : [],
    findOne: async () => booking,
    save: async (entity: typeof booking) => {
      saves++;
      Object.assign(booking, entity);
      return entity;
    },
  };
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === Vehicle) return { findOne: async () => ({ id: 7 }) };
      if (entity === Booking) return bookingRepository;
      if (entity === BookingStatusHistory) return {
        save: async (record: Record<string, unknown>) => { history.push(record); },
      };
      throw new Error('Unexpected entity');
    },
  };
  const dataSource = {
    getRepository: () => bookingRepository,
    transaction: async (fn: (em: typeof manager) => Promise<unknown>) => {
      transactions++;
      return fn(manager);
    },
  } as unknown as DataSource;
  return {
    service: new BookingExpiryService(dataSource),
    booking,
    history,
    get saves() { return saves; },
    get transactions() { return transactions; },
  };
}

test('expires overdue pending hold and records exactly one transition', async () => {
  const ctx = setup();
  assert.equal(await ctx.service.expireBatch(), 1);
  assert.equal(ctx.booking.status, BookingStatus.EXPIRED);
  assert.equal(ctx.saves, 1);
  assert.equal(ctx.history.length, 1);
  assert.equal(ctx.history[0].fromStatus, BookingStatus.PENDING);
  assert.equal(ctx.history[0].toStatus, BookingStatus.EXPIRED);
  assert.equal(ctx.history[0].performedById, null);
});

test('does not overwrite a booking confirmed while the sweep was queued', async () => {
  const ctx = setup(BookingStatus.CONFIRMED);
  assert.equal(await ctx.service.expireBatch(), 0);
  assert.equal(ctx.booking.status, BookingStatus.CONFIRMED);
  assert.equal(ctx.saves, 0);
  assert.equal(ctx.history.length, 0);
});

test('does not start transactions if no holds are due', async () => {
  const ctx = setup(BookingStatus.PENDING, false);
  assert.equal(await ctx.service.expireBatch(), 0);
  assert.equal(ctx.transactions, 0);
});

test('does not emit a second history entry after a hold was expired', async () => {
  const ctx = setup();
  assert.equal(await ctx.service.expireBatch(), 1);
  assert.equal(await ctx.service.expireBatch(), 0);
  assert.equal(ctx.history.length, 1);
});
