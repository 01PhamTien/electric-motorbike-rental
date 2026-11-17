import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { MaintenanceRecord, MaintenanceStatus } from '../maintenance/maintenance.entity';
import { BookingStatusHistory } from '../bookings/booking-status-history.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { HandoverDto } from './dto';
import { HandoverKind, HandoverRecord } from './handover.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { assertPickupWindow } from './handover-policy';
import { PaymentPurpose, PaymentTransaction } from '../payments/payment.entity';

@Injectable()
export class HandoversService {
  constructor(private readonly dataSource: DataSource, @Optional() private readonly notifications?: NotificationsService, @Optional() private readonly audit?: AuditService) {}
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
      if (kind === HandoverKind.PICKUP && dto.requiresMaintenance) throw new BadRequestException('Chỉ có thể đánh dấu cần bảo dưỡng khi nhận trả xe');
      if (kind === HandoverKind.RETURN && dto.requiresMaintenance && !dto.damageNotes?.trim()) throw new BadRequestException('Cần mô tả hư hỏng hoặc vấn đề an toàn trước khi đưa xe vào bảo dưỡng');
      if (kind === HandoverKind.PICKUP) {
        const payments = await manager.getRepository(PaymentTransaction).find({ where: { bookingId } });
        const cents = (value: string | number) => Math.round(Number(value) * 100);
        const collected = (purpose: PaymentPurpose) => payments.filter(p => p.purpose === purpose).reduce((sum, p) => sum + cents(p.amount), 0);
        const rentOutstanding = cents(booking.rentalAmount) - collected(PaymentPurpose.RENT);
        const depositOutstanding = cents(booking.depositSnapshot) - collected(PaymentPurpose.DEPOSIT);
        if (rentOutstanding > 0 || depositOutstanding > 0) {
          throw new BadRequestException('Chưa thể bàn giao xe: cần thu đủ tiền thuê và tiền cọc. Còn thiếu tiền thuê ' + (Math.max(0, rentOutstanding) / 100).toLocaleString('vi-VN') + ' VND, tiền cọc ' + (Math.max(0, depositOutstanding) / 100).toLocaleString('vi-VN') + ' VND.');
        }
      }
      if (kind === HandoverKind.PICKUP && vehicle.status !== VehicleStatus.ACTIVE)
        throw new BadRequestException('Xe hiện không sẵn sàng để bàn giao');
      if (kind === HandoverKind.PICKUP && (!vehicle.isActive || !vehicle.station?.isActive))
        throw new BadRequestException('Xe hoặc trạm nhận hiện không hoạt động');
      if (current.role === Role.STAFF && current.stationId !== vehicle.stationId)
        throw new ForbiddenException('Đơn ngoài điểm thuê được phân công');
      const expected = kind === HandoverKind.PICKUP ? BookingStatus.CONFIRMED : BookingStatus.RENTING;
      const next = kind === HandoverKind.PICKUP ? BookingStatus.RENTING : BookingStatus.COMPLETED;
      if (booking.status !== expected) throw new BadRequestException(`Chỉ được ${kind === HandoverKind.PICKUP ? 'giao' : 'trả'} xe khi đơn là ${expected}`);
      if (kind === HandoverKind.PICKUP) assertPickupWindow(booking.pickupAt, booking.returnAt);
      if (kind === HandoverKind.RETURN) {
        const pickup = await manager.getRepository(HandoverRecord).findOneBy({ bookingId, kind: HandoverKind.PICKUP });
        if (!pickup) throw new BadRequestException('Thiếu biên bản giao xe');
        if (dto.odometerKm < Number(pickup.odometerKm)) throw new BadRequestException('Số km trả không được nhỏ hơn lúc giao');
      }
      const record = await manager.getRepository(HandoverRecord).save(manager.getRepository(HandoverRecord).create({
        bookingId, kind, batteryPercent: dto.batteryPercent, odometerKm: String(dto.odometerKm), conditionNote: dto.conditionNote, staffId: current.sub,
        inspectionChecklist: dto.inspectionChecklist?.length ? JSON.stringify([...new Set(dto.inspectionChecklist)]) : null,
        damageNotes: dto.damageNotes?.trim() || null, requiresMaintenance: kind === HandoverKind.RETURN && dto.requiresMaintenance === true,
        photoUrls: dto.photoUrls?.length ? JSON.stringify(dto.photoUrls) : null,
      }));
      booking.status = next;
      await manager.getRepository(Booking).save(booking);
      // A rented vehicle must not appear available for another reservation.
      // It becomes bookable again only after the return handover is recorded.
      let maintenanceRecordId: number | null = null;
      if (kind === HandoverKind.RETURN && dto.requiresMaintenance === true) {
        const maintenance = await manager.getRepository(MaintenanceRecord).save(manager.getRepository(MaintenanceRecord).create({
          vehicleId: vehicle.id, scheduledAt: new Date(), completedAt: null, reason: 'Kiểm tra sau trả xe #' + bookingId,
          description: dto.damageNotes!.trim() + (dto.conditionNote.trim() ? '\n\nTình trạng tổng quát: ' + dto.conditionNote.trim() : ''),
          cost: '0.00', status: MaintenanceStatus.SCHEDULED, createdById: current.sub,
        }));
        maintenanceRecordId = maintenance.id;
        vehicle.status = VehicleStatus.MAINTENANCE;
      } else {
        vehicle.status = kind === HandoverKind.PICKUP ? VehicleStatus.INACTIVE : (vehicle.isActive ? VehicleStatus.ACTIVE : VehicleStatus.INACTIVE);
      }
      await manager.getRepository(Vehicle).save(vehicle);
      await manager.getRepository(BookingStatusHistory).save({ bookingId, fromStatus: expected, toStatus: next, performedById: current.sub,
        reason: kind === HandoverKind.PICKUP ? 'Đã giao xe' : 'Đã nhận xe trả' });
      return { bookingId, status: next, record, maintenanceRecordId, customerId: booking.customerId };
    });
    await this.audit?.record(current.sub, kind === HandoverKind.PICKUP ? 'VEHICLE_PICKED_UP' : 'VEHICLE_RETURNED', 'BOOKING', bookingId, { batteryPercent: dto.batteryPercent, odometerKm: dto.odometerKm, inspectionChecklist: dto.inspectionChecklist, damageNotes: dto.damageNotes, requiresMaintenance: dto.requiresMaintenance === true, maintenanceRecordId: outcome.maintenanceRecordId, photoCount: dto.photoUrls?.length ?? 0 });
    await this.notifications?.create(outcome.customerId, 'HANDOVER', kind === HandoverKind.PICKUP ? 'Đã nhận xe' : 'Đã trả xe',
      kind === HandoverKind.PICKUP ? 'Đơn thuê #' + bookingId + ' đã được bàn giao xe.' : (outcome.maintenanceRecordId ? 'Đơn thuê #' + bookingId + ' đã nhận trả. Xe được chuyển sang bảo dưỡng để kiểm tra an toàn.' : 'Đơn thuê #' + bookingId + ' đã hoàn tất trả xe.'), bookingId);
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
