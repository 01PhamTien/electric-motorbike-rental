import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { VehicleModel } from '../vehicle-models/vehicle-model.entity';
import { Station } from '../stations/station.entity';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';
import { VehicleTransfer, VehicleTransferStatus } from '../transfers/vehicle-transfer.entity';
import { VehicleImage } from './vehicle-image.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>,
    @InjectRepository(VehicleModel) private readonly models: Repository<VehicleModel>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @Optional() @InjectRepository(VehicleImage) private readonly images?: Repository<VehicleImage>,
  ) {}

  findAllForAdmin() {
    return this.repo.find({ relations: { images: true }, order: { id: 'DESC' } });
  }

  private async validateReferences(modelId: number, stationId: number) {
    if (!(await this.models.exist({ where: { id: modelId } }))) throw new BadRequestException('Dòng xe không tồn tại');
    if (!(await this.stations.exist({ where: { id: stationId, isActive: true } }))) throw new BadRequestException('Điểm thuê không tồn tại hoặc đã ngừng hoạt động');
  }

  findAll(stationId?: number) {
    const qb = this.repo.createQueryBuilder('vehicle')
      // QueryBuilder does not automatically load TypeORM eager relations.
      // Customer screens need station/model to render real fleet and station availability.
      .leftJoinAndSelect('vehicle.station', 'station')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('vehicle.images', 'images')
      .where('vehicle.isActive = :active', { active: true })
      .andWhere('station.isActive = :stationActive', { stationActive: true })
      .andWhere(qb => 'NOT EXISTS ' + qb.subQuery().select('1').from(VehicleTransfer, 'transfer')
        .where('transfer.vehicleId = vehicle.id')
        .andWhere('transfer.status IN (:...transferStatuses)')
        .getQuery(), { transferStatuses: [VehicleTransferStatus.PENDING, VehicleTransferStatus.IN_TRANSIT] })
      .orderBy('vehicle.id', 'DESC');
    if (stationId) qb.andWhere('vehicle.stationId = :stationId', { stationId });
    return qb.getMany();
  }

  async findOne(id: number) {
    const vehicle = await this.repo.findOne({ where: { id }, relations: { images: true } });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    return vehicle;
  }

  async addImage(vehicleId: number, rawUrl: string) {
    const vehicle = await this.repo.findOneBy({ id: vehicleId });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    const imageUrl = rawUrl.trim();
    let parsed: URL;
    try { parsed = new URL(imageUrl); } catch { throw new BadRequestException('Đường dẫn ảnh không hợp lệ'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || imageUrl.length > 2048) {
      throw new BadRequestException('Ảnh phải dùng URL HTTP(S) hợp lệ, tối đa 2048 ký tự');
    }
    if (!this.images) throw new Error('Vehicle image repository is not configured');
    return this.images.save(this.images.create({ vehicleId, imageUrl }));
  }

  async removeImage(vehicleId: number, imageId: number) {
    if (!this.images) throw new Error('Vehicle image repository is not configured');
    const image = await this.images.findOneBy({ id: imageId, vehicleId });
    if (!image) throw new NotFoundException('Không tìm thấy ảnh thuộc xe này');
    await this.images.remove(image);
    return { success: true };
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
    if (dto.stationId !== undefined && dto.stationId !== vehicle.stationId) {
      throw new BadRequestException('Không đổi trạm trực tiếp trong hồ sơ xe. Hãy sử dụng chức năng điều chuyển để lưu đầy đủ lịch sử bàn giao.');
    }
    await this.validateReferences(dto.modelId ?? vehicle.modelId, dto.stationId ?? vehicle.stationId);
    Object.assign(vehicle, {
      ...dto,
      ...(dto.dailyRate !== undefined ? { dailyRate: String(dto.dailyRate) } : {}),
      ...(dto.depositAmount !== undefined ? { depositAmount: String(dto.depositAmount) } : {}),
    });
    return this.repo.save(vehicle);
  }
}
