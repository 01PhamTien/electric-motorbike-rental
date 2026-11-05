import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BookingStatusHistory } from '../bookings/booking-status-history.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { HandoverDto } from './dto';
import { HandoverKind, HandoverRecord } from './handover.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HandoversService {
  constructor(private readonly dataSource: DataSource, @Optional() private readonly notifications?: NotificationsService) {}
  async process(current: JwtUser, bookingId: number, kind: HandoverKind, dto: HandoverDto) {
    if (current.role !== Role.ADMIN && current.role !== Role.STAFF) throw new ForbiddenException();
    // Match the vehicle -> booking lock order used by BookingsService.
    // Avoid competing lock orders when pickup/return overlaps confirmation or cancellation.
    const candidate = await this.dataSource.getRepository(Booking).findOne({
      where: { id: bookingId },
      select: { id: true, vehicleId: true },
    });
    if (!candidate) throw new NotFoundException('Không tìm thấy đơn');
    const outcome = await this.dataSource.transaction(async manager => {
      const vehicle = await manager.getRepository(Vehicle).findOne({
        where: { id: candidate.vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe của đơn');
      const booking = await manager.getRepository(Booking).findOne({
        where: { id: bookingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn');
      if (booking.vehicleId !== vehicle.id) throw new BadRequestException('Xe của đơn đã thay đổi, vui lòng thử lại');
      if (kind === HandoverKind.PICKUP && vehicle.status !== VehicleStatus.ACTIVE)
        throw new BadRequestException('Xe hiện không sẵn sàng để bàn giao');
      if (kind === HandoverKind.PICKUP && (!vehicle.isActive || !vehicle.station?.isActive))
        throw new BadRequestException('Xe hoặc trạm nhận hiện không hoạt động');
      if (current.role === Role.STAFF && current.stationId !== vehicle.stationId)
        throw new ForbiddenException('Đơn ngoài điểm thuê được phân công');
      const expected = kind === HandoverKind.PICKUP ? BookingStatus.CONFIRMED : BookingStatus.RENTING;
      const next = kind === HandoverKind.PICKUP ? BookingStatus.RENTING : BookingStatus.COMPLETED;
      if (booking.status !== expected) throw new BadRequestException(`Chỉ được ${kind === HandoverKind.PICKUP ? 'giao' : 'trả'} xe khi đơn là ${expected}`);
      if (kind === HandoverKind.PICKUP && booking.returnAt <= new Date()) throw new BadRequestException('Đơn đã quá thời hạn trả dự kiến');
      if (kind === HandoverKind.RETURN) {
        const pickup = await manager.getRepository(HandoverRecord).findOneBy({ bookingId, kind: HandoverKind.PICKUP });
        if (!pickup) throw new BadRequestException('Thiếu biên bản giao xe');
        if (dto.odometerKm < Number(pickup.odometerKm)) throw new BadRequestException('Số km trả không được nhỏ hơn lúc giao');
      }
      const record = await manager.getRepository(HandoverRecord).save(manager.getRepository(HandoverRecord).create({
        bookingId, kind, batteryPercent: dto.batteryPercent, odometerKm: String(dto.odometerKm), conditionNote: dto.conditionNote, staffId: current.sub,
      }));
      booking.status = next;
      await manager.getRepository(Booking).save(booking);
      // A rented vehicle must not appear available for another reservation.
      // It becomes bookable again only after the return handover is recorded.
      vehicle.status = kind === HandoverKind.PICKUP ? VehicleStatus.INACTIVE : VehicleStatus.ACTIVE;
      await manager.getRepository(Vehicle).save(vehicle);
      await manager.getRepository(BookingStatusHistory).save({ bookingId, fromStatus: expected, toStatus: next, performedById: current.sub,
        reason: kind === HandoverKind.PICKUP ? 'Đã giao xe' : 'Đã nhận xe trả' });
      return { bookingId, status: next, record, customerId: booking.customerId };
    });
    await this.notifications?.create(outcome.customerId, 'HANDOVER', kind === HandoverKind.PICKUP ? 'Đã nhận xe' : 'Đã trả xe',
      kind === HandoverKind.PICKUP ? 'Đơn thuê #' + bookingId + ' đã được bàn giao xe.' : 'Đơn thuê #' + bookingId + ' đã hoàn tất trả xe.', bookingId);
    const { customerId: _customerId, ...result } = outcome;
    return result;
  }
  async list(current: JwtUser, bookingId: number) {
    const booking = await this.dataSource.getRepository(Booking).findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn');
    if (current.role === Role.CUSTOMER && booking.customerId !== current.sub) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
    return this.dataSource.getRepository(HandoverRecord).find({ where: { bookingId }, order: { id: 'ASC' } });
  }
}
