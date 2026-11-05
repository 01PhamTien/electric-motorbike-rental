import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { VehicleModel } from '../vehicle-models/vehicle-model.entity';
import { Station } from '../stations/station.entity';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';
import { VehicleTransfer, VehicleTransferStatus } from '../transfers/vehicle-transfer.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>,
    @InjectRepository(VehicleModel) private readonly models: Repository<VehicleModel>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
  ) {}

  findAllForAdmin() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  private async validateReferences(modelId: number, stationId: number) {
    if (!(await this.models.exist({ where: { id: modelId } }))) throw new BadRequestException('Dòng xe không tồn tại');
    if (!(await this.stations.exist({ where: { id: stationId, isActive: true } }))) throw new BadRequestException('Điểm thuê không tồn tại hoặc đã ngừng hoạt động');
  }

  findAll(stationId?: number) {
    const qb = this.repo.createQueryBuilder('vehicle')
      .where('vehicle.isActive = :active', { active: true })
      .andWhere(qb => 'NOT EXISTS ' + qb.subQuery().select('1').from(VehicleTransfer, 'transfer')
        .where('transfer.vehicleId = vehicle.id')
        .andWhere('transfer.status IN (:...transferStatuses)')
        .getQuery(), { transferStatuses: [VehicleTransferStatus.PENDING, VehicleTransferStatus.IN_TRANSIT] })
      .orderBy('vehicle.id', 'DESC');
    if (stationId) qb.andWhere('vehicle.stationId = :stationId', { stationId });
    return qb.getMany();
  }

  async findOne(id: number) {
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    return vehicle;
  }

  async create(dto: CreateVehicleDto) {
    await this.validateReferences(dto.modelId, dto.stationId);
    return this.repo.save(this.repo.create({
      ...dto,
      dailyRate: String(dto.dailyRate),
      depositAmount: String(dto.depositAmount),
    }));
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);
    await this.validateReferences(dto.modelId ?? vehicle.modelId, dto.stationId ?? vehicle.stationId);
    Object.assign(vehicle, {
      ...dto,
      ...(dto.dailyRate !== undefined ? { dailyRate: String(dto.dailyRate) } : {}),
      ...(dto.depositAmount !== undefined ? { depositAmount: String(dto.depositAmount) } : {}),
    });
    return this.repo.save(vehicle);
  }
}
