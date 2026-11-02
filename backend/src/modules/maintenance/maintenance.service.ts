import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from '../bookings/booking.entity';
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
    const scheduledAt = new Date(dto.scheduledAt);
    const plannedEndAt = new Date(dto.plannedEndAt);
    if (!Number.isFinite(scheduledAt.getTime()) || !Number.isFinite(plannedEndAt.getTime()) || plannedEndAt <= scheduledAt) {
      throw new BadRequestException('Thời gian kết thúc dự kiến phải sau thời gian bắt đầu');
    }
    if (scheduledAt <= new Date()) throw new BadRequestException('Thời gian bảo dưỡng phải ở tương lai');

    return this.dataSource.transaction(async manager => {
      const vehicleRepo = manager.getRepository(Vehicle);
      const maintenanceRepo = manager.getRepository(MaintenanceRecord);
      const vehicle = await vehicleRepo.findOne({
        where: { id: dto.vehicleId }, lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user, vehicle);
      if (vehicle.status === VehicleStatus.INACTIVE) throw new BadRequestException('Xe đang ngừng khai thác');
      if (vehicle.status === VehicleStatus.MAINTENANCE) throw new BadRequestException('Xe đang bảo dưỡng thực tế, không thể lên lịch thêm');

      const overlappingMaintenance = await maintenanceRepo.createQueryBuilder('m')
        .where('m.vehicleId = :vehicleId', { vehicleId: vehicle.id })
        .andWhere('m.status IN (:...statuses)', { statuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] })
        .andWhere('(m.status = :inProgress OR (m.scheduledAt < :plannedEndAt AND m.plannedEndAt > :scheduledAt))', {
          inProgress: MaintenanceStatus.IN_PROGRESS, scheduledAt, plannedEndAt,
        })
        .getOne();
      if (overlappingMaintenance) throw new BadRequestException('Xe đã có lịch bảo dưỡng trùng thời gian');

      const overlappingBooking = await manager.getRepository(Booking).createQueryBuilder('b')
        .where('b.vehicleId = :vehicleId', { vehicleId: vehicle.id })
        .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.RENTING, BookingStatus.PENDING] })
        .andWhere('(b.status != :pending OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)', {
          pending: BookingStatus.PENDING, now: new Date(),
        })
        .andWhere('b.pickupAt < :plannedEndAt AND b.returnAt > :scheduledAt', { scheduledAt, plannedEndAt })
        .getOne();
      if (overlappingBooking) throw new BadRequestException('Không thể lên lịch bảo dưỡng trùng với đơn thuê còn hiệu lực');

      const record = maintenanceRepo.create({
        vehicleId: vehicle.id, scheduledAt, plannedEndAt, completedAt: null,
        reason: dto.reason.trim(), description: dto.description?.trim() || null,
        cost: (Math.round((dto.cost ?? 0) * 100) / 100).toFixed(2),
        status: MaintenanceStatus.SCHEDULED, previousVehicleStatus: vehicle.status,
        createdById: user.sub,
      });
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
      if (dto.scheduledAt || dto.plannedEndAt) {
        if (record.status !== MaintenanceStatus.SCHEDULED) {
          throw new BadRequestException('Chỉ được đổi khung giờ khi phiếu còn ở trạng thái SCHEDULED');
        }
        const nextStart = dto.scheduledAt ? new Date(dto.scheduledAt) : record.scheduledAt;
        const nextEnd = dto.plannedEndAt ? new Date(dto.plannedEndAt) : record.plannedEndAt;
        if (!Number.isFinite(nextStart.getTime()) || !Number.isFinite(nextEnd.getTime()) || nextEnd <= nextStart) {
          throw new BadRequestException('Thời gian kết thúc dự kiến phải sau thời gian bắt đầu');
        }
        const overlappingMaintenance = await repo.createQueryBuilder('m')
          .where('m.vehicleId = :vehicleId', { vehicleId: vehicle.id })
          .andWhere('m.id != :id', { id: record.id })
          .andWhere('m.status IN (:...statuses)', { statuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] })
          .andWhere('(m.status = :inProgress OR (m.scheduledAt < :nextEnd AND m.plannedEndAt > :nextStart))', {
            inProgress: MaintenanceStatus.IN_PROGRESS, nextStart, nextEnd,
          }).getOne();
        if (overlappingMaintenance) throw new BadRequestException('Khung giờ bị trùng với phiếu bảo dưỡng khác');

        const overlappingBooking = await manager.getRepository(Booking).createQueryBuilder('b')
          .where('b.vehicleId = :vehicleId', { vehicleId: vehicle.id })
          .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RENTING] })
          .andWhere('(b.status != :pending OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)', {
            pending: BookingStatus.PENDING, now: new Date(),
          })
          .andWhere('b.pickupAt < :nextEnd AND b.returnAt > :nextStart', { nextStart, nextEnd }).getOne();
        if (overlappingBooking) throw new BadRequestException('Khung giờ bị trùng với đơn thuê còn hiệu lực');
        record.scheduledAt = nextStart;
        record.plannedEndAt = nextEnd;
      }
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
        if (dto.status === MaintenanceStatus.IN_PROGRESS) {
          if (vehicle.status === VehicleStatus.INACTIVE) throw new BadRequestException('Xe đang ngừng khai thác');
          vehicle.status = VehicleStatus.MAINTENANCE;
          await vehicleRepo.save(vehicle);
        }
        if ([MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED].includes(dto.status)) {
          record.completedAt = dto.status === MaintenanceStatus.COMPLETED ? new Date() : null;
          if (vehicle.status === VehicleStatus.MAINTENANCE) {
            vehicle.status = record.previousVehicleStatus ?? VehicleStatus.ACTIVE;
            await vehicleRepo.save(vehicle);
          }
        }
      }
      return repo.save(record);
    });
  }
}
