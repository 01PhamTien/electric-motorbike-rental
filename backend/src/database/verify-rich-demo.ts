import 'dotenv/config';
import 'reflect-metadata';
import assert = require('node:assert/strict');
import { In, Like } from 'typeorm';
import { migrationDataSource } from './data-source';
import { Station } from '../modules/stations/station.entity';
import { VehicleModel } from '../modules/vehicle-models/vehicle-model.entity';
import { Vehicle } from '../modules/vehicles/vehicle.entity';
import { User } from '../modules/users/user.entity';
import { Booking } from '../modules/bookings/booking.entity';
import { HandoverRecord } from '../modules/handovers/handover.entity';
import { PaymentTransaction } from '../modules/payments/payment.entity';
import { MaintenanceRecord } from '../modules/maintenance/maintenance.entity';
import { VehicleLocation } from '../modules/locations/vehicle-location.entity';

async function verify() {
  if (process.env.DB_TYPE !== 'mssql' || !/^[A-Za-z0-9_]+_test$/.test(process.env.DB_DATABASE || '')) {
    throw new Error('Seed verification is only permitted on isolated SQL Server *_test databases');
  }
  await migrationDataSource.initialize();
  try {
    const ds = migrationDataSource;
    const vehicles = await ds.getRepository(Vehicle).find({ where: { code: Like('VG-DEMO-%') } });
    const ids = vehicles.map(v => v.id);
    assert.equal(ids.length, 120);
    const bookings = await ds.getRepository(Booking).find({ where: { vehicleId: In(ids) } });
    assert.equal(bookings.length, 240);
    const bookingIds = bookings.map(b => b.id);
    const userCount = await ds.getRepository(User).countBy({ email: Like('%@demo.voltgo.invalid') });
    assert.equal(userCount, 64);
    assert.equal(await ds.getRepository(Station).count(), 8);
    assert.equal(await ds.getRepository(VehicleModel).count(), 12);
    assert.equal(await ds.getRepository(HandoverRecord).countBy({ bookingId: In(bookingIds) }), 240);
    assert.equal(await ds.getRepository(PaymentTransaction).countBy({ bookingId: In(bookingIds) }), 360);
    assert.equal(await ds.getRepository(VehicleLocation).countBy({ vehicleId: In(ids), source: 'DEMO_SIMULATION' }), 120);
    assert.equal(await ds.getRepository(MaintenanceRecord).count(), 40);
    console.log('Verified exact rich demo row counts, 240 bookings, no duplicates.');
  } finally {
    await migrationDataSource.destroy();
  }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
