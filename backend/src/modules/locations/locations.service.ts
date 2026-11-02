import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { SimulateLocationDto } from './dto';
import { VehicleLocation } from './vehicle-location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(VehicleLocation) private readonly repo: Repository<VehicleLocation>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
  ) {}

  private async assertVehicleScope(current: JwtUser, vehicleId: number) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    if (current.role === Role.STAFF && current.stationId !== vehicle.stationId) {
      throw new ForbiddenException('Không được truy cập xe ngoài điểm được phân công');
    }
    return vehicle;
  }

  async simulate(current: JwtUser, vehicleId: number, dto: SimulateLocationDto) {
    await this.assertVehicleScope(current, vehicleId);
    return this.repo.save(this.repo.create({
      vehicleId,
      latitude: String(dto.latitude),
      longitude: String(dto.longitude),
      source: 'MANUAL_SIMULATION',
      updatedById: current.sub,
    }));
  }

  async latest(current: JwtUser, vehicleId: number) {
    await this.assertVehicleScope(current, vehicleId);
    return this.repo.findOne({ where: { vehicleId }, order: { createdAt: 'DESC' } });
  }

  async history(current: JwtUser, vehicleId: number) {
    await this.assertVehicleScope(current, vehicleId);
    return this.repo.find({ where: { vehicleId }, order: { createdAt: 'DESC' }, take: 200 });
  }
}
