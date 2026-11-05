import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Booking } from '../bookings/booking.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceRecord, MaintenanceStatus } from './maintenance.entity';
import { AuditService } from '../audit/audit.service';

const OPEN_MAINTENANCE = [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS];

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MaintenanceRecord) private readonly repo: Repository<MaintenanceRecord>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @Optional() private readonly audit?: AuditService,
  ) {}

  private assertStationAccess(user: JwtUser, vehicle: Vehicle) {
    if (user.role === Role.STAFF && user.stationId !== vehicle.stationId) {
      throw new ForbiddenException('Không được xử lý xe ngoài điểm được phân công');
    }
  }

  async list(user: JwtUser, vehicleId?: number) {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.scheduledAt', 'DESC').take(200);
    if (vehicleId) {
      const vehicle = await this.vehicles.findOne({ where: { id: vehicleId } });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStationAccess(user, vehicle);
      qb.andWhere('m.vehicleId = :vehicleId', { vehicleId });
    } else if (user.role === Role.STAFF) {
      if (!user.stationId) return [];
      qb.innerJoin(Vehicle, 'v', 'v.id = m.vehicleId').andWhere('v.stationId = :stationId', { stationId: user.stationId });
    }
    return qb.getMany();
  }


  async upsertSchedule(user: JwtUser, dto: UpsertMaintenanceScheduleDto) {
    const vehicle = await this.scopedVehicle(user, dto.vehicleId);
    const existing = await this.schedules.findOne({ where: { vehicleId: vehicle.id } });
    const schedule = this.schedules.create({
      ...(existing ?? {}),
      vehicleId: vehicle.id,
      intervalKm: dto.intervalKm,
      intervalDays: dto.intervalDays,
      warningKm: dto.warningKm ?? 500,
      warningDays: dto.warningDays ?? 7,
      lastServiceOdometerKm: String(dto.lastServiceOdometerKm),
      lastServiceAt: new Date(dto.lastServiceAt),
      isActive: dto.isActive ?? true,
      updatedById: user.sub,
    });
    return this.schedules.save(schedule);
  }

  async listSchedules(user: JwtUser) {
    const qb = this.schedules.createQueryBuilder('s')
      .innerJoinAndSelect(Vehicle, 'v', 'v.id = s.vehicleId')
      .orderBy('s.updatedAt', 'DESC');
    if (user.role === Role.STAFF) {
      if (!user.stationId) return [];
      qb.andWhere('v.stationId = :stationId', { stationId: user.stationId });
    }
    const schedules = await qb.getMany();
    const results = await Promise.all(schedules.map(async schedule => {
      const vehicle = await this.vehicles.findOne({ where: { id: schedule.vehicleId } });
      if (!vehicle) return null;
      const latest = await this.handovers.findOne({ where: { booking: { vehicleId: vehicle.id } }, order: { createdAt: 'DESC' } });
      const currentOdometerKm = latest ? Number(latest.odometerKm) : Number(schedule.lastServiceOdometerKm);
      const dueOdometerKm = Number(schedule.lastServiceOdometerKm) + schedule.intervalKm;
      const kmRemaining = dueOdometerKm - currentOdometerKm;
      const dueAt = new Date(schedule.lastServiceAt.getTime() + schedule.intervalDays * 86_400_000);
      const daysRemaining = Math.ceil((dueAt.getTime() - Date.now()) / 86_400_000);
      const overdue = kmRemaining <= 0 || daysRemaining <= 0;
      const dueSoon = !overdue && (kmRemaining <= schedule.warningKm || daysRemaining <= schedule.warningDays);
      return {
        scheduleId: schedule.id, vehicleId: vehicle.id, vehicleCode: vehicle.code,
        model: vehicle.model ? vehicle.model.brand + ' ' + vehicle.model.name : '',
        stationName: vehicle.station?.name ?? '',
        currentOdometerKm, lastServiceOdometerKm: Number(schedule.lastServiceOdometerKm),
        dueOdometerKm, kmRemaining, dueAt, daysRemaining,
        intervalKm: schedule.intervalKm, intervalDays: schedule.intervalDays,
        isActive: schedule.isActive,
        alert: !schedule.isActive ? 'INACTIVE' : overdue ? 'OVERDUE' : dueSoon ? 'DUE_SOON' : 'OK',
        lastOdometerAt: latest?.createdAt ?? null,
      };
    }));
    return results.filter(Boolean);
  }

  async create(user: JwtUser, dto: CreateMaintenanceDto) {
    return this.dataSource.transaction(async manager => {
      const vehicleRepo = manager.getRepository(Vehicle);
      const recordRepo = manager.getRepository(MaintenanceRecord);
      const bookingRepo = manager.getRepository(Booking);
      const vehicle = await vehicleRepo.findOne({
        where: { id: dto.vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStationAccess(user, vehicle);
      if (!vehicle.isActive || vehicle.status !== VehicleStatus.ACTIVE) {
        throw new BadRequestException('Chỉ có thể lập lịch bảo dưỡng cho xe đang hoạt động và sẵn sàng');
      }
      const renting = await bookingRepo.findOne({ where: { vehicleId: vehicle.id, status: BookingStatus.RENTING } });
      if (renting) throw new BadRequestException('Xe đang được khách thuê, không thể đưa vào bảo dưỡng');
      const openRecord = await recordRepo.findOne({ where: { vehicleId: vehicle.id, status: MaintenanceStatus.SCHEDULED } });
      if (openRecord) throw new BadRequestException('Xe đã có phiếu bảo dưỡng chưa hoàn tất');

      const record = recordRepo.create({
        vehicleId: vehicle.id,
        scheduledAt: new Date(dto.scheduledAt),
        completedAt: null,
        reason: dto.reason.trim(),
        description: dto.description?.trim() || null,
        cost: String(dto.cost ?? 0),
        status: MaintenanceStatus.SCHEDULED,
        createdById: user.sub,
      });
      vehicle.status = VehicleStatus.MAINTENANCE;
      await vehicleRepo.save(vehicle);
      const saved = await recordRepo.save(record);
      await this.audit?.record(user.sub, 'MAINTENANCE_SCHEDULED', 'MAINTENANCE', saved.id, { vehicleId: vehicle.id, reason: saved.reason, scheduledAt: saved.scheduledAt });
      return saved;
    });
  }

  async update(user: JwtUser, id: number, dto: UpdateMaintenanceDto) {
    return this.dataSource.transaction(async manager => {
      const recordRepo = manager.getRepository(MaintenanceRecord);
      const vehicleRepo = manager.getRepository(Vehicle);
      const record = await recordRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record) throw new NotFoundException('Không tìm thấy phiếu bảo dưỡng');
      const vehicle = await vehicleRepo.findOne({
        where: { id: record.vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStationAccess(user, vehicle);
      if (!OPEN_MAINTENANCE.includes(record.status)) {
        throw new BadRequestException('Phiếu đã kết thúc, không thể cập nhật');
      }
      if (dto.scheduledAt) record.scheduledAt = new Date(dto.scheduledAt);
      if (dto.reason !== undefined) record.reason = dto.reason.trim();
      if (dto.description !== undefined) record.description = dto.description?.trim() || null;
      if (dto.cost !== undefined) record.cost = String(dto.cost);
      if (dto.status) {
        const allowed: Record<MaintenanceStatus, MaintenanceStatus[]> = {
          [MaintenanceStatus.SCHEDULED]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
          [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
          [MaintenanceStatus.COMPLETED]: [],
          [MaintenanceStatus.CANCELLED]: [],
        };
        if (!allowed[record.status].includes(dto.status)) {
          throw new BadRequestException('Không thể chuyển phiếu bảo dưỡng sang trạng thái này');
        }
        record.status = dto.status;
        if (dto.status === MaintenanceStatus.COMPLETED) record.completedAt = new Date();
        if (dto.status === MaintenanceStatus.CANCELLED) record.completedAt = null;
      }
      const saved = await recordRepo.save(record);
      if ([MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED].includes(record.status)) {
        const anotherOpen = await recordRepo.createQueryBuilder('m')
          .where('m.vehicleId = :vehicleId', { vehicleId: vehicle.id })
          .andWhere('m.id != :id', { id: record.id })
          .andWhere('m.status IN (:...statuses)', { statuses: OPEN_MAINTENANCE })
          .getOne();
        if (!anotherOpen && vehicle.status === VehicleStatus.MAINTENANCE) {
          vehicle.status = vehicle.isActive ? VehicleStatus.ACTIVE : VehicleStatus.INACTIVE;
          await vehicleRepo.save(vehicle);
        }
      }
      await this.audit?.record(user.sub, 'MAINTENANCE_UPDATED', 'MAINTENANCE', saved.id, { vehicleId: vehicle.id, status: saved.status, cost: saved.cost });
      return saved;
    });
  }
}
