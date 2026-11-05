import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Station } from '../stations/station.entity';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { MaintenanceRecord, MaintenanceStatus } from '../maintenance/maintenance.entity';
import { AuditService } from '../audit/audit.service';
import { CreateVehicleTransferDto } from './vehicle-transfer.dto';
import { VehicleTransfer, VehicleTransferStatus } from './vehicle-transfer.entity';

const OPEN_BOOKINGS = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.RENTING];
const OPEN_MAINTENANCE = [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS];

@Injectable()
export class TransfersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VehicleTransfer) private readonly transfers: Repository<VehicleTransfer>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(MaintenanceRecord) private readonly maintenance: Repository<MaintenanceRecord>,
    private readonly audit: AuditService,
  ) {}

  private assertStation(user: JwtUser, stationId: number) {
    if (user.role === Role.STAFF && user.stationId !== stationId) {
      throw new ForbiddenException('Bạn chỉ được xử lý điều chuyển liên quan đến trạm được phân công');
    }
  }

  async list(user: JwtUser) {
    const qb = this.transfers.createQueryBuilder('t')
      .innerJoin('vehicles', 'v', 'v.id = t.vehicleId')
      .innerJoin('stations', 'src', 'src.id = t.sourceStationId')
      .innerJoin('stations', 'dst', 'dst.id = t.destinationStationId')
      .select('t.id', 'id')
      .addSelect('t.vehicleId', 'vehicleId')
      .addSelect('t.sourceStationId', 'sourceStationId')
      .addSelect('t.destinationStationId', 'destinationStationId')
      .addSelect('t.requestedById', 'requestedById')
      .addSelect('t.dispatchedById', 'dispatchedById')
      .addSelect('t.receivedById', 'receivedById')
      .addSelect('t.status', 'status')
      .addSelect('t.note', 'note')
      .addSelect('t.dispatchedAt', 'dispatchedAt')
      .addSelect('t.receivedAt', 'receivedAt')
      .addSelect('t.cancelledAt', 'cancelledAt')
      .addSelect('t.createdAt', 'createdAt')
      .addSelect('v.code', 'vehicleCode')
      .addSelect('src.name', 'sourceStationName')
      .addSelect('dst.name', 'destinationStationName')
      .orderBy('t.createdAt', 'DESC')
      .take(200);
    if (user.role === Role.STAFF) {
      if (user.stationId == null) return [];
      qb.andWhere('(t.sourceStationId = :stationId OR t.destinationStationId = :stationId)', { stationId: user.stationId });
    }
    return qb.getRawMany();
  }

  async create(user: JwtUser, dto: CreateVehicleTransferDto) {
    return this.dataSource.transaction(async manager => {
      const vehicleRepo = manager.getRepository(Vehicle);
      const stationRepo = manager.getRepository(Station);
      const bookingRepo = manager.getRepository(Booking);
      const maintenanceRepo = manager.getRepository(MaintenanceRecord);
      const transferRepo = manager.getRepository(VehicleTransfer);

      const vehicle = await vehicleRepo.findOne({
        where: { id: dto.vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      this.assertStation(user, vehicle.stationId);
      if (!vehicle.isActive || vehicle.status !== VehicleStatus.ACTIVE) {
        throw new BadRequestException('Chỉ xe đang hoạt động và sẵn sàng mới được điều chuyển');
      }
      if (vehicle.stationId === dto.destinationStationId) throw new BadRequestException('Trạm nhận phải khác trạm hiện tại');
      const [source, destination] = await Promise.all([
        stationRepo.findOne({ where: { id: vehicle.stationId, isActive: true } }),
        stationRepo.findOne({ where: { id: dto.destinationStationId, isActive: true } }),
      ]);
      if (!source || !destination) throw new BadRequestException('Trạm đi hoặc trạm đến không tồn tại/đã ngừng hoạt động');

      const bookingConflict = await bookingRepo.createQueryBuilder('b')
        .where('b.vehicleId = :vehicleId', { vehicleId: vehicle.id })
        .andWhere('b.status IN (:...statuses)', { statuses: OPEN_BOOKINGS })
        .andWhere('(b.status <> :pendingStatus OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)', {
          pendingStatus: BookingStatus.PENDING, now: new Date(),
        })
        .getOne();
      if (bookingConflict) throw new BadRequestException('Xe đang có đơn thuê chưa kết thúc, không thể điều chuyển');
      const maintenanceConflict = await maintenanceRepo.findOne({ where: { vehicleId: vehicle.id, status: MaintenanceStatus.SCHEDULED } });
      const maintenanceInProgress = await maintenanceRepo.findOne({ where: { vehicleId: vehicle.id, status: MaintenanceStatus.IN_PROGRESS } });
      if (maintenanceConflict || maintenanceInProgress) throw new BadRequestException('Xe đang có phiếu bảo dưỡng chưa hoàn tất');
      const pending = await transferRepo.createQueryBuilder('t')
        .where('t.vehicleId = :vehicleId', { vehicleId: vehicle.id })
        .andWhere('t.status IN (:...statuses)', { statuses: [VehicleTransferStatus.PENDING, VehicleTransferStatus.IN_TRANSIT] })
        .getOne();
      if (pending) throw new BadRequestException('Xe đã có yêu cầu điều chuyển đang xử lý');

      const saved = await transferRepo.save(transferRepo.create({
        vehicleId: vehicle.id,
        sourceStationId: source.id,
        destinationStationId: destination.id,
        requestedById: user.sub,
        dispatchedById: null,
        receivedById: null,
        status: VehicleTransferStatus.PENDING,
        note: dto.note?.trim() || null,
        dispatchedAt: null,
        receivedAt: null,
        cancelledAt: null,
      }));
      await this.audit.record(user.sub, 'VEHICLE_TRANSFER_REQUESTED', 'VEHICLE_TRANSFER', saved.id, {
        vehicleId: vehicle.id, sourceStationId: source.id, destinationStationId: destination.id,
      });
      return saved;
    });
  }

  async dispatch(user: JwtUser, id: number) {
    return this.dataSource.transaction(async manager => {
      const transferRepo = manager.getRepository(VehicleTransfer);
      const vehicleRepo = manager.getRepository(Vehicle);
      const bookingRepo = manager.getRepository(Booking);
      const maintenanceRepo = manager.getRepository(MaintenanceRecord);
      const transfer = await transferRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!transfer) throw new NotFoundException('Không tìm thấy yêu cầu điều chuyển');
      this.assertStation(user, transfer.sourceStationId);
      if (transfer.status !== VehicleTransferStatus.PENDING) throw new BadRequestException('Yêu cầu không còn ở trạng thái chờ bàn giao');
      const vehicle = await vehicleRepo.findOne({ where: { id: transfer.vehicleId }, lock: { mode: 'pessimistic_write' } });
      if (!vehicle || vehicle.stationId !== transfer.sourceStationId) throw new BadRequestException('Xe không còn thuộc trạm đi của yêu cầu');
      if (!vehicle.isActive || vehicle.status !== VehicleStatus.ACTIVE) throw new BadRequestException('Xe không ở trạng thái sẵn sàng để bàn giao');
      const booking = await bookingRepo.createQueryBuilder('b').where('b.vehicleId = :id', { id: vehicle.id })
        .andWhere('b.status IN (:...statuses)', { statuses: OPEN_BOOKINGS })
        .andWhere('(b.status <> :pendingStatus OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)', {
          pendingStatus: BookingStatus.PENDING, now: new Date(),
        }).getOne();
      if (booking) throw new BadRequestException('Xe đã phát sinh đơn thuê chưa kết thúc');
      const maintenance = await maintenanceRepo.createQueryBuilder('m').where('m.vehicleId = :id', { id: vehicle.id })
        .andWhere('m.status IN (:...statuses)', { statuses: OPEN_MAINTENANCE }).getOne();
      if (maintenance) throw new BadRequestException('Xe đang có bảo dưỡng chưa hoàn tất');
      transfer.status = VehicleTransferStatus.IN_TRANSIT;
      transfer.dispatchedById = user.sub;
      transfer.dispatchedAt = new Date();
      const saved = await transferRepo.save(transfer);
      await this.audit.record(user.sub, 'VEHICLE_TRANSFER_DISPATCHED', 'VEHICLE_TRANSFER', id, { vehicleId: vehicle.id });
      return saved;
    });
  }

  async receive(user: JwtUser, id: number) {
    return this.dataSource.transaction(async manager => {
      const transferRepo = manager.getRepository(VehicleTransfer);
      const vehicleRepo = manager.getRepository(Vehicle);
      const stationRepo = manager.getRepository(Station);
      const transfer = await transferRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!transfer) throw new NotFoundException('Không tìm thấy yêu cầu điều chuyển');
      this.assertStation(user, transfer.destinationStationId);
      if (transfer.status !== VehicleTransferStatus.IN_TRANSIT) throw new BadRequestException('Xe chưa được bàn giao hoặc yêu cầu đã kết thúc');
      const vehicle = await vehicleRepo.findOne({ where: { id: transfer.vehicleId }, lock: { mode: 'pessimistic_write' } });
      if (!vehicle || vehicle.stationId !== transfer.sourceStationId) throw new BadRequestException('Vị trí xe không khớp với lịch sử điều chuyển');
      const destination = await stationRepo.findOne({ where: { id: transfer.destinationStationId, isActive: true } });
      if (!destination) throw new BadRequestException('Trạm nhận đã ngừng hoạt động');
      vehicle.stationId = destination.id;
      await vehicleRepo.save(vehicle);
      transfer.status = VehicleTransferStatus.COMPLETED;
      transfer.receivedById = user.sub;
      transfer.receivedAt = new Date();
      const saved = await transferRepo.save(transfer);
      await this.audit.record(user.sub, 'VEHICLE_TRANSFER_RECEIVED', 'VEHICLE_TRANSFER', id, {
        vehicleId: vehicle.id, destinationStationId: destination.id,
      });
      return { transfer: saved, vehicle };
    });
  }

  async cancel(user: JwtUser, id: number) {
    return this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(VehicleTransfer);
      const transfer = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!transfer) throw new NotFoundException('Không tìm thấy yêu cầu điều chuyển');
      this.assertStation(user, transfer.sourceStationId);
      if (transfer.status !== VehicleTransferStatus.PENDING) throw new BadRequestException('Chỉ được hủy yêu cầu trước khi bàn giao');
      transfer.status = VehicleTransferStatus.CANCELLED;
      transfer.cancelledAt = new Date();
      const saved = await repo.save(transfer);
      await this.audit.record(user.sub, 'VEHICLE_TRANSFER_CANCELLED', 'VEHICLE_TRANSFER', id);
      return saved;
    });
  }
}
