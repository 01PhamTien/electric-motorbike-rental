import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceRecord, MaintenanceStatus } from './maintenance.entity';

@Injectable()
export class MaintenanceService {
  constructor(private readonly dataSource: DataSource) {}

  private assertStation(user: JwtUser, vehicle: Vehicle) {
    if (user.role === Role.STAFF && user.stationId !== vehicle.stationId) {
      throw new ForbiddenException('Không được xử lý xe ngoài điểm được phân công');
    }
  }

  async list(user: JwtUser, vehicleId?: number) {
    const repo = this.dataSource.getRepository(MaintenanceRecord);
    const qb = repo.createQueryBuilder('m')
      .orderBy('m.scheduledAt', 'DESC')
      .take(200);
    if (vehicleId) {
      const vehicle = await this.dataSource.getRepository(Vehicle).findOneBy({ id: vehicleId });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user, vehicle);
      qb.andWhere('m.vehicleId = :vehicleId', { vehicleId });
    } else if (user.role === Role.STAFF) {
      if (!user.stationId) return [];
      qb.innerJoin(Vehicle, 'vehicle', 'vehicle.id = m.vehicleId')
        .andWhere('vehicle.stationId = :stationId', { stationId: user.stationId });
    }
    return qb.getMany();
  }

  async create(user: JwtUser, dto: CreateMaintenanceDto) {
    return this.dataSource.transaction(async manager => {
      const vehicleRepo = manager.getRepository(Vehicle);
      const maintenanceRepo = manager.getRepository(MaintenanceRecord);
      const vehicle = await vehicleRepo.findOne({
        where: { id: dto.vehicleId }, lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user, vehicle);
      if (vehicle.status === VehicleStatus.INACTIVE) throw new BadRequestException('Xe đang ngừng khai thác');
      const openCount = await maintenanceRepo.count({
        where: [
          { vehicleId: vehicle.id, status: MaintenanceStatus.SCHEDULED },
          { vehicleId: vehicle.id, status: MaintenanceStatus.IN_PROGRESS },
        ],
      });
      if (openCount) throw new BadRequestException('Xe đã có phiếu bảo dưỡng chưa kết thúc');
      const record = maintenanceRepo.create({
        vehicleId: vehicle.id,
        scheduledAt: new Date(dto.scheduledAt),
        completedAt: null,
        reason: dto.reason.trim(),
        description: dto.description?.trim() || null,
        cost: (Math.round((dto.cost ?? 0) * 100) / 100).toFixed(2),
        status: MaintenanceStatus.SCHEDULED,
        previousVehicleStatus: vehicle.status,
        createdById: user.sub,
      });
      vehicle.status = VehicleStatus.MAINTENANCE;
      await vehicleRepo.save(vehicle);
      return maintenanceRepo.save(record);
    });
  }

  async update(user: JwtUser, id: number, dto: UpdateMaintenanceDto) {
    return this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(MaintenanceRecord);
      const vehicleRepo = manager.getRepository(Vehicle);
      const record = await repo.findOne({
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!record) throw new NotFoundException('Không tìm thấy phiếu bảo dưỡng');
      const vehicle = await vehicleRepo.findOne({
        where: { id: record.vehicleId }, lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user, vehicle);
      if ([MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED].includes(record.status)) {
        throw new BadRequestException('Phiếu đã kết thúc, không thể cập nhật');
      }
      if (dto.scheduledAt) record.scheduledAt = new Date(dto.scheduledAt);
      if (dto.reason !== undefined) record.reason = dto.reason.trim();
      if (dto.description !== undefined) record.description = dto.description.trim() || null;
      if (dto.cost !== undefined) record.cost = (Math.round(dto.cost * 100) / 100).toFixed(2);

      if (dto.status) {
        const allowed: Record<MaintenanceStatus, MaintenanceStatus[]> = {
          [MaintenanceStatus.SCHEDULED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED],
          [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
          [MaintenanceStatus.COMPLETED]: [],
          [MaintenanceStatus.CANCELLED]: [],
        };
        if (!allowed[record.status].includes(dto.status)) {
          throw new BadRequestException('Chuyển trạng thái bảo dưỡng không hợp lệ');
        }
        record.status = dto.status;
        if (dto.status === MaintenanceStatus.COMPLETED) {
          record.completedAt = new Date();
          const anotherOpen = await repo.createQueryBuilder('m')
            .where('m.vehicleId = :vehicleId', { vehicleId: vehicle.id })
            .andWhere('m.id != :id', { id: record.id })
            .andWhere('m.status IN (:...statuses)', { statuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] })
            .getCount();
          if (!anotherOpen) vehicle.status = record.previousVehicleStatus ?? VehicleStatus.ACTIVE;
          await vehicleRepo.save(vehicle);
        } else if (dto.status === MaintenanceStatus.CANCELLED) {
          record.completedAt = null;
          const anotherOpen = await repo.createQueryBuilder('m')
            .where('m.vehicleId = :vehicleId', { vehicleId: vehicle.id })
            .andWhere('m.id != :id', { id: record.id })
            .andWhere('m.status IN (:...statuses)', { statuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] })
            .getCount();
          if (!anotherOpen) vehicle.status = record.previousVehicleStatus ?? VehicleStatus.ACTIVE;
          await vehicleRepo.save(vehicle);
        }
      }
      return repo.save(record);
    });
  }
}
