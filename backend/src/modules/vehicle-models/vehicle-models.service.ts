import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleModelDto, UpdateVehicleModelDto } from './dto';
import { VehicleModel } from './vehicle-model.entity';

@Injectable()
export class VehicleModelsService {
  constructor(@InjectRepository(VehicleModel) private readonly repo: Repository<VehicleModel>) {}

  findAll() {
    return this.repo.find({ order: { brand: 'ASC', name: 'ASC' } });
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy dòng xe');
    return item;
  }

  create(dto: CreateVehicleModelDto) {
    return this.repo.save(this.repo.create({ ...dto, specifications: dto.specifications || null, imageUrl: dto.imageUrl || null }));
  }

  async update(id: number, dto: UpdateVehicleModelDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }
}
