import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { Role } from '../src/common/enums/role.enum';
import { JwtUser } from '../src/common/interfaces/jwt-user.interface';
import { BookingExpiryService } from '../src/modules/bookings/booking-expiry.service';
import { Booking } from '../src/modules/bookings/booking.entity';
import { BookingStatusHistory } from '../src/modules/bookings/booking-status-history.entity';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { Station } from '../src/modules/stations/station.entity';
import { User } from '../src/modules/users/user.entity';
import { VehicleModel } from '../src/modules/vehicle-models/vehicle-model.entity';
import { Vehicle } from '../src/modules/vehicles/vehicle.entity';

const dbName = process.env.DB_DATABASE || '';
// This test DROPS the schema. Never point it at a development or production database.
if (!/^[a-zA-Z0-9_]+_test$/.test(dbName)) {
  throw new Error('Refusing destructive integration test: DB_DATABASE must end in _test');
}

test('MySQL: concurrent booking, overlap rejection and expired-hold release', async () => {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    // Only test databases may use dropSchema and synchronize.
    dropSchema: true,
    synchronize: true,
    timezone: '+07:00',
    entities: [join(__dirname, '../src/modules/**/*.entity.ts')],
  });
  await dataSource.initialize();
  try {
    const station = await dataSource.getRepository(Station).save({
      name: 'Trạm kiểm thử Hải Châu',
      address: 'Đà Nẵng',
      latitude: '16.0470790',
      longitude: '108.2062300',
      isActive: true,
    });
    const model = await dataSource.getRepository(VehicleModel).save({
      brand: 'Test', name: 'Electric Test Vehicle',
    });
    const vehicle = await dataSource.getRepository(Vehicle).save({
      code: 'TEST-DN-001',
      licensePlate: '43-TEST-001',
      modelId: model.id,
      stationId: station.id,
      dailyRate: '180000',
      depositAmount: '1000000',
      isActive: true,
    });
    const customers = await dataSource.getRepository(User).save([
      { fullName: 'Customer A', email: 'customer-a@example.test', passwordHash: 'test-only', role: Role.CUSTOMER },
      { fullName: 'Customer B', email: 'customer-b@example.test', passwordHash: 'test-only', role: Role.CUSTOMER },
    ]);
    const user = (id: number): JwtUser => ({
      sub: id, email: 'customer@example.test', role: Role.CUSTOMER, stationId: null,
    });
    const bookingService = new BookingsService(
      dataSource,
      new ConfigService({ BOOKING_HOLD_MINUTES: '15' }),
      dataSource.getRepository(Booking),
    );
    const expiryService = new BookingExpiryService(dataSource);
    const pickupAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const returnAt = new Date(Date.now() + 4 * 86_400_000).toISOString();
    const dto = { vehicleId: vehicle.id, pickupAt, returnAt };

    // Both requests must use the same database and contend on the vehicle row lock.
    const attempts = await Promise.allSettled([
      bookingService.create(user(customers[0].id), dto),
      bookingService.create(user(customers[1].id), dto),
    ]);
    assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((a) => a.status === 'rejected').length, 1);
    const first = await dataSource.getRepository(Booking).findOneByOrFail({ status: BookingStatus.PENDING });

    // Simulate passage of the hold window without sleeping.
    await dataSource.getRepository(Booking).update(first.id, {
      holdExpiresAt: new Date(Date.now() - 60_000),
    });
    assert.equal(await expiryService.expireBatch(), 1);
    assert.equal(await expiryService.expireBatch(), 0);
    const expired = await dataSource.getRepository(Booking).findOneByOrFail({ id: first.id });
    assert.equal(expired.status, BookingStatus.EXPIRED);
    const histories = await dataSource.getRepository(BookingStatusHistory).find({
      where: { bookingId: first.id, toStatus: BookingStatus.EXPIRED },
    });
    assert.equal(histories.length, 1);

    const second = await bookingService.create(user(customers[1].id), dto);
    assert.equal(second?.status, BookingStatus.PENDING);
    assert.notEqual(second?.id, first.id);

    // Operational queue must respect station boundaries and reject customers.
    const admin: JwtUser = { sub: 1001, email: 'admin@example.test', role: Role.ADMIN, stationId: null };
    const staff: JwtUser = { sub: 1002, email: 'staff@example.test', role: Role.STAFF, stationId: station.id };
    const otherStationStaff: JwtUser = { ...staff, stationId: station.id + 999 };
    const adminBookings = await bookingService.listForOperations(admin);
    const stationBookings = await bookingService.listForOperations(staff);
    const foreignBookings = await bookingService.listForOperations(otherStationStaff);
    assert.equal(adminBookings.length, 2);
    assert.equal(stationBookings.length, 2);
    assert.equal(foreignBookings.length, 0);
    await assert.rejects(() => bookingService.listForOperations(user(customers[0].id)));
  } finally {
    await dataSource.destroy();
  }
});
