
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../app.module';
import { Role } from '../common/enums/role.enum';
import { User } from '../modules/users/user.entity';
import { Station } from '../modules/stations/station.entity';
import { VehicleModel } from '../modules/vehicle-models/vehicle-model.entity';
import { Vehicle } from '../modules/vehicles/vehicle.entity';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Demo seeding is disabled in production: never create sample accounts or credentials',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);

    const stationRepo = dataSource.getRepository(Station);
    const userRepo = dataSource.getRepository(User);
    const modelRepo = dataSource.getRepository(VehicleModel);
    const vehicleRepo = dataSource.getRepository(Vehicle);

    // ==========================================
    // 1. CREATE DEFAULT STATION
    // ==========================================

    let station = await stationRepo.findOne({
      where: { name: 'Điểm thuê trung tâm Hải Châu' },
    });

    if (!station) {
      station = await stationRepo.save(
        stationRepo.create({
          name: 'Điểm thuê trung tâm Hải Châu',
          address: 'Hải Châu, Đà Nẵng',
          latitude: '16.0470790',
          longitude: '108.2062300',
          phone: '0900000001',
          isActive: true,
        }),
      );

      console.log('Created default station.');
    }

    // ==========================================
    // 2. CREATE DEFAULT VEHICLE MODEL
    // ==========================================

    let model = await modelRepo.findOne({
      where: {
        brand: 'VinFast',
        name: 'Feliz S',
      },
    });

    if (!model) {
      model = await modelRepo.save(
        modelRepo.create({
          brand: 'VinFast',
          name: 'Feliz S',
          specifications: 'Xe máy điện mẫu dữ liệu ban đầu',
        }),
      );

      console.log('Created default vehicle model.');
    }

    // ==========================================
    // 3. CREATE OR UPDATE ADMIN ACCOUNT
    // ==========================================

    const adminEmail = 'admin@evrental.local';
    const adminPassword = 'Admin@123456';

    // Find account by the correct email first.
    let admin = await userRepo.findOne({
      where: { email: adminEmail },
    });

    // Recover account created previously with email = "admin".
    if (!admin) {
      admin = await userRepo.findOne({
        where: { email: 'admin' },
      });
    }

    const adminPasswordHash = await bcrypt.hash(
      adminPassword,
      12,
    );

    if (!admin) {
      admin = userRepo.create({
        fullName: 'Quản trị viên',
        email: adminEmail,
        phone: '0900000002',
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        stationId: null,
      });

      console.log('Creating ADMIN account...');
    } else {
      admin.fullName = 'Quản trị viên';
      admin.email = adminEmail;
      admin.passwordHash = adminPasswordHash;
      admin.role = Role.ADMIN;
      admin.stationId = null;

      console.log('Updating existing ADMIN account...');
    }

    await userRepo.save(admin);

    // ==========================================
    // 4. CREATE DEFAULT STAFF ACCOUNT
    // ==========================================

    const staffEmail = 'staff@evrental.local';

    let staff = await userRepo.findOne({
      where: { email: staffEmail },
    });

    if (!staff) {
      staff = userRepo.create({
        fullName: 'Nhân viên Hải Châu',
        email: staffEmail,
        phone: '0900000003',
        passwordHash: await bcrypt.hash('Staff@123456', 12),
        role: Role.STAFF,
        stationId: station.id,
      });

      await userRepo.save(staff);

      console.log('Created default STAFF account.');
    }

    // ==========================================
    // 5. CREATE DEFAULT VEHICLE
    // ==========================================

    let vehicle = await vehicleRepo.findOne({
      where: { code: 'EV-DN-001' },
    });

    if (!vehicle) {
      vehicle = vehicleRepo.create({
        code: 'EV-DN-001',
        licensePlate: '43MD1-000.01',
        modelId: model.id,
        stationId: station.id,
        dailyRate: '180000',
        depositAmount: '1000000',
      });

      await vehicleRepo.save(vehicle);

      console.log('Created default vehicle.');
    }

    // ==========================================
    // 6. SUMMARY
    // ==========================================

    console.log('');
    console.log('======================================');
    console.log('       VOLTGO DATABASE SEED');
    console.log('======================================');
    console.log('Seed completed successfully.');
    console.log('');
    console.log('ADMIN ACCOUNT');
    console.log('Email: admin@evrental.local');
    console.log('Password: Admin@123456');
    console.log('');
    console.log('STAFF ACCOUNT');
    console.log('Email: staff@evrental.local');
    console.log('Password: Staff@123456');
    console.log('');
    console.log('======================================');
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
