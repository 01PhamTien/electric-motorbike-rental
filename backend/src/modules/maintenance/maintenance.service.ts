import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceRecord, MaintenanceStatus } from './maintenance.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRecord) private readonly repo: Repository<MaintenanceRecord>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
  ) {}

  private async scopedVehicle(user: JwtUser, vehicleId: number) {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    if (user.role === Role.STAFF && user.stationId !== vehicle.stationId) {
      throw new ForbiddenException('Không được xử lý xe ngoài điểm được phân công');
    }
    return vehicle;
  }

  async list(user: JwtUser, vehicleId?: number) {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.scheduledAt', 'DESC').take(200);
    if (vehicleId) {
      await this.scopedVehicle(user, vehicleId);
      qb.andWhere('m.vehicleId = :vehicleId', { vehicleId });
    } else if (user.role === Role.STAFF) {
      if (!user.stationId) return [];
      qb.innerJoin(Vehicle, 'v', 'v.id = m.vehicleId').andWhere('v.stationId = :stationId', { stationId: user.stationId });
    }
    return qb.getMany();
  }

  async create(user: JwtUser, dto: CreateMaintenanceDto) {
    const vehicle = await this.scopedVehicle(user, dto.vehicleId);
    if ([VehicleStatus.INACTIVE].includes(vehicle.status)) throw new BadRequestException('Xe đang ngừng khai thác');
    const record = this.repo.create({
      vehicleId: vehicle.id,
      scheduledAt: new Date(dto.scheduledAt),
      completedAt: null,
      reason: dto.reason,
      description: dto.description ?? null,
      cost: String(dto.cost ?? 0),
      status: MaintenanceStatus.SCHEDULED,
      createdById: user.sub,
    });
    await this.vehicles.update(vehicle.id, { status: VehicleStatus.MAINTENANCE });
    return this.repo.save(record);
  }

  async update(user: JwtUser, id: number, dto: UpdateMaintenanceDto) {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Không tìm thấy phiếu bảo dưỡng');
    const vehicle = await this.scopedVehicle(user, record.vehicleId);
    if (record.status === MaintenanceStatus.COMPLETED || record.status === MaintenanceStatus.CANCELLED) {
      throw new BadRequestException('Phiếu đã kết thúc, không thể cập nhật');
    }
    if (dto.scheduledAt) record.scheduledAt = new Date(dto.scheduledAt);
    if (dto.reason !== undefined) record.reason = dto.reason;
    if (dto.description !== undefined) record.description = dto.description;
    if (dto.cost !== undefined) record.cost = String(dto.cost);
    if (dto.status) {
      record.status = dto.status;
      if (dto.status === MaintenanceStatus.COMPLETED) {
        record.completedAt = new Date();
        if (vehicle.status === VehicleStatus.MAINTENANCE) {
          await this.vehicles.update(vehicle.id, { status: VehicleStatus.ACTIVE });
        }
      } else if (dto.status === MaintenanceStatus.CANCELLED && vehicle.status === VehicleStatus.MAINTENANCE) {
        await this.vehicles.update(vehicle.id, { status: VehicleStatus.ACTIVE });
      }
    }
    return this.repo.save(record);
  }
}
