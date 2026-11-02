import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStationDto, UpdateStationDto } from './dto';
import { Station } from './station.entity';

@Injectable()
export class StationsService {
  constructor(@InjectRepository(Station) private readonly repo: Repository<Station>) {}

  findAll() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  async findOne(id: number) {
    const station = await this.repo.findOne({ where: { id } });
    if (!station) throw new NotFoundException('Không tìm thấy điểm thuê');
    return station;
  }

  create(dto: CreateStationDto) {
    return this.repo.save(this.repo.create({ ...dto, latitude: String(dto.latitude), longitude: String(dto.longitude) }));
  }

  async update(id: number, dto: UpdateStationDto) {
    const station = await this.findOne(id);
    Object.assign(station, {
      ...dto,
      ...(dto.latitude !== undefined ? { latitude: String(dto.latitude) } : {}),
      ...(dto.longitude !== undefined ? { longitude: String(dto.longitude) } : {}),
    });
    return this.repo.save(station);
  }
}
