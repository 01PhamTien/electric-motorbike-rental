import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
  constructor(@InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>) {}

  findAll(stationId?: number) {
    return this.repo.find({ where: stationId ? { stationId, isActive: true } : { isActive: true }, order: { id: 'DESC' } });
  }

  async findOne(id: number) {
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    return vehicle;
  }

  create(dto: CreateVehicleDto) {
    return this.repo.save(this.repo.create({
      ...dto,
      dailyRate: String(dto.dailyRate),
      depositAmount: String(dto.depositAmount),
    }));
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);
    Object.assign(vehicle, {
      ...dto,
      ...(dto.dailyRate !== undefined ? { dailyRate: String(dto.dailyRate) } : {}),
      ...(dto.depositAmount !== undefined ? { depositAmount: String(dto.depositAmount) } : {}),
    });
    return this.repo.save(vehicle);
  }
}
