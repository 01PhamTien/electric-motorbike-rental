import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { MaintenanceStatus } from '../maintenance/maintenance.entity';
import { VehicleAvailabilityQueryDto } from './availability.dto';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
  constructor(@InjectRepository(Vehicle) private readonly repo: Repository<Vehicle>) {}

  findAll(stationId?: number) {
    return this.repo.find({ where: stationId ? { stationId, isActive: true } : { isActive: true }, order: { id: 'DESC' } });
  }

  async findAvailable(query: VehicleAvailabilityQueryDto) {
    const pickupAt = new Date(query.pickupAt);
    const returnAt = new Date(query.returnAt);
    if (!Number.isFinite(pickupAt.getTime()) || !Number.isFinite(returnAt.getTime())) {
      throw new BadRequestException('Thời gian nhận hoặc trả không hợp lệ');
    }
    if (returnAt <= pickupAt) {
      throw new BadRequestException('Thời gian trả phải sau thời gian nhận');
    }
    if (pickupAt <= new Date()) {
      throw new BadRequestException('Thời gian nhận xe phải ở tương lai');
    }
    if (query.minDailyRate !== undefined && query.maxDailyRate !== undefined && query.minDailyRate > query.maxDailyRate) {
      throw new BadRequestException('Giá tối thiểu không được lớn hơn giá tối đa');
    }

    const now = new Date();
    const qb = this.repo.createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('vehicle.station', 'station')
      .where('vehicle.isActive = :isActive', { isActive: true })
      .andWhere('vehicle.status = :vehicleStatus', { vehicleStatus: VehicleStatus.ACTIVE })
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM bookings booking
        WHERE booking.vehicleId = vehicle.id
          AND booking.status IN (:...blockingStatuses)
          AND (booking.status != :pendingStatus OR booking.holdExpiresAt IS NULL OR booking.holdExpiresAt > :now)
          AND booking.pickupAt < :returnAt
          AND booking.returnAt > :pickupAt
      )`, {
        blockingStatuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RENTING],
        pendingStatus: BookingStatus.PENDING,
        now,
        pickupAt,
        returnAt,
      })
      // Scheduled maintenance blocks only overlapping search windows.
      // IN_PROGRESS maintenance blocks all searches until the vehicle is released.
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM maintenance_records maintenance
        WHERE maintenance.vehicleId = vehicle.id
          AND maintenance.status IN (:...maintenanceStatuses)
          AND (maintenance.status = :inProgress OR
               (maintenance.plannedEndAt IS NULL OR (maintenance.scheduledAt < :returnAt AND maintenance.plannedEndAt > :pickupAt)))
      )`, {
        maintenanceStatuses: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS],
        inProgress: MaintenanceStatus.IN_PROGRESS,
        pickupAt,
        returnAt,
      });

    if (query.stationId) qb.andWhere('vehicle.stationId = :stationId', { stationId: query.stationId });
    if (query.modelId) qb.andWhere('vehicle.modelId = :modelId', { modelId: query.modelId });
    if (query.minDailyRate !== undefined) qb.andWhere('vehicle.dailyRate >= :minDailyRate', { minDailyRate: query.minDailyRate });
    if (query.maxDailyRate !== undefined) qb.andWhere('vehicle.dailyRate <= :maxDailyRate', { maxDailyRate: query.maxDailyRate });

    const vehicles = await qb.orderBy('vehicle.dailyRate', 'ASC').addOrderBy('vehicle.id', 'DESC').getMany();
    const rentalDays = Math.ceil((returnAt.getTime() - pickupAt.getTime()) / 86_400_000);

    return {
      criteria: {
        pickupAt: pickupAt.toISOString(),
        returnAt: returnAt.toISOString(),
        rentalDays,
        stationId: query.stationId ?? null,
        modelId: query.modelId ?? null,
        minDailyRate: query.minDailyRate ?? null,
        maxDailyRate: query.maxDailyRate ?? null,
      },
      count: vehicles.length,
      items: vehicles.map(vehicle => ({
        ...vehicle,
        estimatedRentalDays: rentalDays,
        estimatedRentalAmount: (rentalDays * Number(vehicle.dailyRate)).toFixed(2),
      })),
    };
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
