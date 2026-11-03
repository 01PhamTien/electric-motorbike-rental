import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { migrationDataSource } from './data-source';
import { Role } from '../common/enums/role.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { VehicleStatus } from '../common/enums/vehicle-status.enum';
import { User } from '../modules/users/user.entity';
import { Station } from '../modules/stations/station.entity';
import { VehicleModel } from '../modules/vehicle-models/vehicle-model.entity';
import { Vehicle } from '../modules/vehicles/vehicle.entity';
import { Booking } from '../modules/bookings/booking.entity';
import { BookingStatusHistory } from '../modules/bookings/booking-status-history.entity';
import { HandoverKind, HandoverRecord } from '../modules/handovers/handover.entity';
import { PaymentMethod, PaymentPurpose, PaymentTransaction } from '../modules/payments/payment.entity';
import { MaintenanceRecord, MaintenanceStatus } from '../modules/maintenance/maintenance.entity';
import { VehicleLocation } from '../modules/locations/vehicle-location.entity';

/**
 * Synthetic showcase data for local VoltGo demo ONLY.
 * - Upserts by stable demo names, emails, vehicle codes and transaction keys.
 * - Never resets, drops, deletes or modifies existing records.
 * - Can be run repeatedly; existing demo records are left untouched.
 * - No real people's contact details, identities or payments.
 * - Dates are relative to the time each NEW booking is created.
 */
const stations = [
  ['Trạm VoltGo Hải Châu', 'Khu vực đường Bạch Đằng, Hải Châu, Đà Nẵng', 16.0676, 108.2210],
  ['Trạm VoltGo Sơn Trà', 'Khu vực đường Ngô Quyền, Sơn Trà, Đà Nẵng', 16.0782, 108.2405],
  ['Trạm VoltGo Mỹ Khê', 'Khu vực đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', 16.0657, 108.2451],
  ['Trạm VoltGo An Thượng', 'Khu vực đường An Thượng, Ngũ Hành Sơn, Đà Nẵng', 16.0504, 108.2440],
  ['Trạm VoltGo Thanh Khê', 'Khu vực đường Điện Biên Phủ, Thanh Khê, Đà Nẵng', 16.0665, 108.1902],
  ['Trạm VoltGo Hòa Xuân', 'Khu vực đường 2 Tháng 9, Cẩm Lệ, Đà Nẵng', 16.0178, 108.2242],
  ['Trạm VoltGo Liên Chiểu', 'Khu vực đường Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng', 16.0798, 108.1522],
  ['Trạm VoltGo Non Nước', 'Khu vực đường Trường Sa, Ngũ Hành Sơn, Đà Nẵng', 15.9999, 108.2682],
] as const;

const models = [
  ['VinFast', 'Feliz S', 180000, 1000000, 'Xe tay ga điện đô thị, phù hợp đi làm và tham quan'],
  ['VinFast', 'Evo200', 155000, 900000, 'Xe điện gọn nhẹ, quãng đường dài, dễ điều khiển'],
  ['VinFast', 'Klara S', 195000, 1200000, 'Thiết kế thanh lịch, phù hợp di chuyển trong thành phố'],
  ['VinFast', 'Vento S', 250000, 1600000, 'Dòng xe điện cao cấp dành cho hành trình dài'],
  ['VinFast', 'Theon S', 310000, 2000000, 'Dòng xe hiệu năng cao, phong cách hiện đại'],
  ['VinFast', 'Motio', 125000, 700000, 'Thiết kế nhỏ gọn, phù hợp quãng đường ngắn'],
  ['Yadea', 'Voltguard', 175000, 1000000, 'Xe điện đô thị cho hành trình tham quan'],
  ['Yadea', 'Orla', 165000, 900000, 'Kiểu dáng thời trang, dễ vận hành'],
  ['Yadea', 'Odora S', 145000, 800000, 'Xe điện tiện dụng, tiết kiệm'],
  ['Dat Bike', 'Weaver 200', 290000, 1800000, 'Kiểu dáng thể thao, trải nghiệm xe điện khác biệt'],
  ['Dat Bike', 'Quantum', 330000, 2000000, 'Xe điện hiện đại cho nhu cầu di chuyển đa dạng'],
  ['Pega', 'Aura S+', 140000, 800000, 'Xe máy điện phổ thông, phù hợp thuê ngắn ngày'],
] as const;

const firstNames = ['Minh Anh', 'Gia Huy', 'Bảo Ngọc', 'Quốc Bảo', 'Thanh Trúc', 'Hoàng Long', 'Phương Linh', 'Tuấn Kiệt', 'Hải Yến', 'Nhật Nam', 'Thảo Nhi', 'Đức Anh', 'Mỹ Linh', 'Khánh Duy', 'Ngọc Hà'];
const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Võ', 'Huỳnh', 'Đặng', 'Bùi'];
const maintenanceReasons = ['Kiểm tra phanh và lốp', 'Kiểm tra pin và bộ sạc', 'Bảo dưỡng định kỳ', 'Kiểm tra đèn và tín hiệu', 'Kiểm tra hệ thống truyền động'];
const DAY = 86_400_000;
const afterDays = (days: number) => new Date(Date.now() + days * DAY);
const dateMoney = (amount: number) => amount.toFixed(2);

async function main() {
  const db = process.env.DB_DATABASE || '';
  const allowedName = db === 'VoltGoDB' || /^[A-Za-z0-9_]+_test$/.test(db);
  if (process.env.NODE_ENV === 'production' || process.env.DB_TYPE !== 'mssql' ||
      process.env.DEMO_SEED_CONFIRM !== 'I_UNDERSTAND_THIS_IS_FAKE_DATA' || !allowedName) {
    throw new Error('Demo data is allowed ONLY on non-production SQL Server VoltGoDB or a *_test database, with DEMO_SEED_CONFIRM=I_UNDERSTAND_THIS_IS_FAKE_DATA');
  }
  await migrationDataSource.initialize();
  const ds = migrationDataSource;
  try {
    if (await ds.showMigrations()) throw new Error('Apply all SQL Server migrations before demo seeding');
    const stationRepo = ds.getRepository(Station);
    const modelRepo = ds.getRepository(VehicleModel);
    const userRepo = ds.getRepository(User);
    const vehicleRepo = ds.getRepository(Vehicle);
    const bookingRepo = ds.getRepository(Booking);
    const historyRepo = ds.getRepository(BookingStatusHistory);
    const handoverRepo = ds.getRepository(HandoverRecord);
    const paymentRepo = ds.getRepository(PaymentTransaction);
    const locationRepo = ds.getRepository(VehicleLocation);
    const maintenanceRepo = ds.getRepository(MaintenanceRecord);
    const counts: Record<string, number> = {};
    const track = (key: string) => { counts[key] = (counts[key] || 0) + 1; };

    const savedStations: Station[] = [];
    for (const [name, address, lat, lng] of stations) {
      let row = await stationRepo.findOneBy({ name });
      if (!row) {
        row = await stationRepo.save(stationRepo.create({
          name, address, latitude: lat.toFixed(7), longitude: lng.toFixed(7),
          phone: null, isActive: true,
        }));
        track('stations');
      }
      savedStations.push(row);
    }

    const savedModels: VehicleModel[] = [];
    for (const [brand, name, , , specifications] of models) {
      let row = await modelRepo.findOneBy({ brand, name });
      if (!row) {
        row = await modelRepo.save(modelRepo.create({ brand, name, specifications: '[DEMO] ' + specifications }));
        track('models');
      }
      savedModels.push(row);
    }

    const demoHash = await bcrypt.hash('VoltGoDemo@2026', 12);
    const customers: User[] = [];
    for (let i = 0; i < 48; i++) {
      const email = 'customer' + String(i + 1).padStart(3, '0') + '@demo.voltgo.invalid';
      let row = await userRepo.findOneBy({ email });
      if (!row) {
        row = await userRepo.save(userRepo.create({
          fullName: lastNames[i % lastNames.length] + ' ' + firstNames[(i * 7 + Math.floor(i / 15)) % firstNames.length],
          email, phone: null, passwordHash: demoHash, role: Role.CUSTOMER, stationId: null,
        }));
        track('customers');
      }
      customers.push(row);
    }

    const staff: User[] = [];
    for (let i = 0; i < stations.length * 2; i++) {
      const station = savedStations[i % savedStations.length];
      const email = 'station-staff' + String(i + 1).padStart(2, '0') + '@demo.voltgo.invalid';
      let row = await userRepo.findOneBy({ email });
      if (!row) {
        row = await userRepo.save(userRepo.create({
          fullName: lastNames[(i + 3) % lastNames.length] + ' ' + firstNames[(i + 5) % firstNames.length],
          email, phone: null, passwordHash: demoHash, role: Role.STAFF, stationId: station.id,
        }));
        track('staff');
      }
      staff.push(row);
    }

    const vehicles: Vehicle[] = [];
    for (let i = 0; i < 120; i++) {
      const code = 'VG-DEMO-' + String(i + 1).padStart(3, '0');
      let row = await vehicleRepo.findOneBy({ code });
      if (!row) {
        const modelIndex = i % savedModels.length;
        const [, , dailyRate, deposit] = models[modelIndex];
        const status = i % 23 === 0 ? VehicleStatus.CHARGING : i % 29 === 0 ? VehicleStatus.MAINTENANCE : VehicleStatus.ACTIVE;
        row = await vehicleRepo.save(vehicleRepo.create({
          code, licensePlate: 'DEMO-43-' + String(i + 1).padStart(4, '0'),
          modelId: savedModels[modelIndex].id,
          stationId: savedStations[i % savedStations.length].id,
          dailyRate: dateMoney(dailyRate + Math.floor(i / 32) * 5000),
          depositAmount: dateMoney(deposit),
          status, isActive: true,
        }));
        track('vehicles');
      }
      vehicles.push(row);
    }

    // Each vehicle gets one completed historical rental and one upcoming record.
    // Historical and future periods are disjoint and never overlap each other.
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const user = customers[i % customers.length];
      const operator = staff[i % staff.length];
      const historicalStart = afterDays(-50 - (i % 22));
      const historicalEnd = new Date(historicalStart.getTime() + (1 + i % 4) * DAY);
      let past = await bookingRepo.findOneBy({ vehicleId: vehicle.id, customerId: user.id, status: BookingStatus.COMPLETED });
      if (!past) {
        const days = Math.ceil((historicalEnd.getTime() - historicalStart.getTime()) / DAY);
        past = await bookingRepo.save(bookingRepo.create({
          customerId: user.id, vehicleId: vehicle.id, pickupAt: historicalStart,
          returnAt: historicalEnd, dailyRateSnapshot: vehicle.dailyRate,
          depositSnapshot: vehicle.depositAmount,
          rentalAmount: dateMoney(days * Number(vehicle.dailyRate)),
          holdExpiresAt: null, status: BookingStatus.COMPLETED, cancelReason: null,
        }));
        track('historicalBookings');
      }

      if (!(await historyRepo.findOneBy({ bookingId: past.id, toStatus: BookingStatus.COMPLETED }))) {
        await historyRepo.save(historyRepo.create({
          bookingId: past.id, fromStatus: BookingStatus.RENTING, toStatus: BookingStatus.COMPLETED,
          performedById: operator.id, reason: '[DEMO] Hoàn tất chuyến thuê',
        }));
        track('histories');
      }
      for (const kind of [HandoverKind.PICKUP, HandoverKind.RETURN]) {
        if (!(await handoverRepo.findOneBy({ bookingId: past.id, kind }))) {
          await handoverRepo.save(handoverRepo.create({
            bookingId: past.id, kind, staffId: operator.id,
            batteryPercent: kind === HandoverKind.PICKUP ? 85 + i % 15 : 25 + i % 25,
            odometerKm: String(1100 + i * 37 + (kind === HandoverKind.RETURN ? 35 + i % 90 : 0)),
            conditionNote: '[DEMO] ' + (kind === HandoverKind.PICKUP ? 'Xe sạch, lốp tốt, đủ phụ kiện' : 'Xe hoàn trả, kiểm tra đạt yêu cầu'),
          }));
          track('handovers');
        }
      }
      for (const [purpose, amount, method] of [
        [PaymentPurpose.RENT, Number(past.rentalAmount), i % 2 ? PaymentMethod.TRANSFER : PaymentMethod.CASH],
        [PaymentPurpose.DEPOSIT, Number(vehicle.depositAmount), PaymentMethod.TRANSFER],
        [PaymentPurpose.REFUND, Number(vehicle.depositAmount), PaymentMethod.TRANSFER],
      ] as const) {
        const key = 'VG-DEMO-' + purpose + '-' + vehicle.code;
        if (!(await paymentRepo.findOneBy({ idempotencyKey: key }))) {
          await paymentRepo.save(paymentRepo.create({
            bookingId: past.id, purpose, method, amount: dateMoney(amount),
            idempotencyKey: key, recordedById: operator.id, note: '[DEMO] Giao dịch giả lập - không phát sinh tiền thật',
          }));
          track('payments');
        }
      }

      const futureCustomer = customers[(i + 11) % customers.length];
      if (!(await bookingRepo.findOneBy({ vehicleId: vehicle.id, customerId: futureCustomer.id }))) {
        const start = afterDays(3 + (i % 20));
        const end = new Date(start.getTime() + (1 + i % 3) * DAY);
        const status = i % 9 === 0 ? BookingStatus.CANCELLED
          : i % 7 === 0 ? BookingStatus.EXPIRED
          : i % 3 === 0 ? BookingStatus.CONFIRMED : BookingStatus.PENDING;
        await bookingRepo.save(bookingRepo.create({
          customerId: futureCustomer.id,
          vehicleId: vehicle.id, pickupAt: start, returnAt: end,
          dailyRateSnapshot: vehicle.dailyRate, depositSnapshot: vehicle.depositAmount,
          rentalAmount: dateMoney(Math.ceil((end.getTime() - start.getTime()) / DAY) * Number(vehicle.dailyRate)),
          // Pending future fixtures should not expire immediately.
          holdExpiresAt: status === BookingStatus.PENDING ? afterDays(2) : null,
          status, cancelReason: status === BookingStatus.CANCELLED ? '[DEMO] Khách hủy lịch trải nghiệm' : null,
        }));
        track('futureBookings');
      }

      // Seed one GPS snapshot, without mutating real location records.
      if (!(await locationRepo.findOneBy({ vehicleId: vehicle.id, source: 'DEMO_SIMULATION' }))) {
        const station = savedStations[i % savedStations.length];
        const lat = Number(station.latitude) + ((i % 7) - 3) * 0.00012;
        const lng = Number(station.longitude) + ((i % 9) - 4) * 0.0001;
        await locationRepo.save(locationRepo.create({
          vehicleId: vehicle.id, latitude: lat.toFixed(7), longitude: lng.toFixed(7),
          source: 'DEMO_SIMULATION', updatedById: operator.id,
        }));
        track('locations');
      }
    }

    // Realistic-looking maintenance history, separate from current vehicle status.
    for (let i = 0; i < 40; i++) {
      const vehicle = vehicles[i * 3];
      const reason = '[DEMO] ' + maintenanceReasons[i % maintenanceReasons.length];
      if (!(await maintenanceRepo.findOneBy({ vehicleId: vehicle.id, reason }))) {
        const scheduledAt = afterDays(-30 - i % 15);
        await maintenanceRepo.save(maintenanceRepo.create({
          vehicleId: vehicle.id, scheduledAt, completedAt: new Date(scheduledAt.getTime() + DAY),
          reason, description: '[DEMO] Kiểm tra định kỳ theo checklist kỹ thuật; dữ liệu giả lập',
          cost: dateMoney(65000 + (i % 7) * 35000),
          status: MaintenanceStatus.COMPLETED, createdById: staff[i % staff.length].id,
        }));
        track('maintenance');
      }
    }

    console.log('VoltGo demo seed completed. New rows (existing rows were preserved):');
    console.log(JSON.stringify(counts, null, 2));
    console.log('48 fictional customer accounts and 16 fictional staff accounts use @demo.voltgo.invalid.');
    console.log('LOCAL DEMO ONLY: password for fictional accounts is VoltGoDemo@2026. Never publish these credentials.');
  } finally {
    await ds.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
