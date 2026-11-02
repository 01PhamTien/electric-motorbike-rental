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
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const stationRepo = dataSource.getRepository(Station);
  const userRepo = dataSource.getRepository(User);
  const modelRepo = dataSource.getRepository(VehicleModel);
  const vehicleRepo = dataSource.getRepository(Vehicle);

  let station = await stationRepo.findOne({ where: { name: 'Điểm thuê trung tâm Hải Châu' } });
  if (!station) {
    station = await stationRepo.save(stationRepo.create({
      name: 'Điểm thuê trung tâm Hải Châu',
      address: 'Hải Châu, Đà Nẵng',
      latitude: '16.0470790',
      longitude: '108.2062300',
      phone: '0900000001',
      isActive: true,
    }));
  }

  let model = await modelRepo.findOne({ where: { brand: 'VinFast', name: 'Feliz S' } });
  if (!model) {
    model = await modelRepo.save(modelRepo.create({
      brand: 'VinFast',
      name: 'Feliz S',
      specifications: 'Xe máy điện mẫu dữ liệu ban đầu',
    }));
  }

  const adminEmail = 'admin@evrental.local';
  if (!(await userRepo.findOne({ where: { email: adminEmail } }))) {
    await userRepo.save(userRepo.create({
      fullName: 'Quản trị viên',
      email: adminEmail,
      phone: '0900000002',
      passwordHash: await bcrypt.hash('Admin@123456', 12),
      role: Role.ADMIN,
      stationId: null,
    }));
  }

  const staffEmail = 'staff@evrental.local';
  if (!(await userRepo.findOne({ where: { email: staffEmail } }))) {
    await userRepo.save(userRepo.create({
      fullName: 'Nhân viên Hải Châu',
      email: staffEmail,
      phone: '0900000003',
      passwordHash: await bcrypt.hash('Staff@123456', 12),
      role: Role.STAFF,
      stationId: station.id,
    }));
  }

  if (!(await vehicleRepo.findOne({ where: { code: 'EV-DN-001' } }))) {
    await vehicleRepo.save(vehicleRepo.create({
      code: 'EV-DN-001',
      licensePlate: '43MD1-000.01',
      modelId: model.id,
      stationId: station.id,
      dailyRate: '180000',
      depositAmount: '1000000',
    }));
  }

  console.log('Seed completed');
  console.log('Admin: admin@evrental.local / Admin@123456');
  console.log('Staff: staff@evrental.local / Staff@123456');
  await app.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
