import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatusHistory } from '../bookings/booking-status-history.entity';
import { BookingCharge } from '../bookings/booking-charge.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { HandoverDto } from './dto';
import { HandoverKind, HandoverRecord } from './handover.entity';
import { HandoverImage } from './handover-image.entity';

@Injectable()
export class HandoversService {
  constructor(private readonly dataSource: DataSource) {}
  async process(current: JwtUser, bookingId: number, kind: HandoverKind, dto: HandoverDto) {
    if (current.role !== Role.ADMIN && current.role !== Role.STAFF) throw new ForbiddenException();
    return this.dataSource.transaction(async manager => {
      const booking = await manager.getRepository(Booking).findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn');
      if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId)
        throw new ForbiddenException('Đơn ngoài điểm thuê được phân công');
      const expected = kind === HandoverKind.PICKUP ? BookingStatus.CONFIRMED : BookingStatus.RENTING;
      const next = kind === HandoverKind.PICKUP ? BookingStatus.RENTING : BookingStatus.COMPLETED;
      if (booking.status !== expected) throw new BadRequestException(`Chỉ được ${kind === HandoverKind.PICKUP ? 'giao' : 'trả'} xe khi đơn là ${expected}`);
      if (kind === HandoverKind.PICKUP && booking.returnAt <= new Date()) throw new BadRequestException('Đơn đã quá thời hạn trả dự kiến');
      let lateFeeAmount = 0;
      if (kind === HandoverKind.RETURN) {
        const pickup = await manager.getRepository(HandoverRecord).findOneBy({ bookingId, kind: HandoverKind.PICKUP });
        if (!pickup) throw new BadRequestException('Thiếu biên bản giao xe');
        if (dto.odometerKm < Number(pickup.odometerKm)) throw new BadRequestException('Số km trả không được nhỏ hơn lúc giao');

        // Late-return policy: 60-minute grace period, then charge each started 24-hour block
        // using the daily rate snapshot agreed when the booking was created.
        const gracePeriodMs = 60 * 60 * 1000;
        const billableLateMs = Date.now() - booking.returnAt.getTime() - gracePeriodMs;
        if (billableLateMs > 0) {
          const billableDays = Math.ceil(billableLateMs / 86_400_000);
          lateFeeAmount = Math.round(billableDays * Number(booking.dailyRateSnapshot) * 100) / 100;
          const hoursLate = Math.ceil((Date.now() - booking.returnAt.getTime()) / 3_600_000);
          await manager.getRepository(BookingCharge).save(manager.getRepository(BookingCharge).create({
            bookingId,
            category: 'LATE_RETURN',
            amount: lateFeeAmount.toFixed(2),
            applyToDeposit: false,
            reason: `Trả muộn ${hoursLate} giờ (đã trừ 60 phút miễn phí), tính ${billableDays} ngày theo đơn giá đã chốt`,
            createdById: current.sub,
          }));
        }
      }
      const recordRepo = manager.getRepository(HandoverRecord);
      const record = await recordRepo.save(recordRepo.create({
        bookingId, kind, batteryPercent: dto.batteryPercent, odometerKm: String(dto.odometerKm),
        conditionNote: dto.conditionNote.trim(), staffId: current.sub,
      }));

      if (dto.imageUrls?.length) {
        const imageRepo = manager.getRepository(HandoverImage);
        await imageRepo.save(dto.imageUrls.map(imageUrl => imageRepo.create({
          handoverId: record.id,
          imageUrl: imageUrl.trim(),
        })));
      }

      booking.status = next;
      await manager.getRepository(Booking).save(booking);
      await manager.getRepository(BookingStatusHistory).save({ bookingId, fromStatus: expected, toStatus: next, performedById: current.sub,
        reason: kind === HandoverKind.PICKUP ? 'Đã giao xe' : 'Đã nhận xe trả' });
      return { bookingId, status: next, record, lateFeeAmount };
    });
  }
  async list(current: JwtUser, bookingId: number) {
    const booking = await this.dataSource.getRepository(Booking).findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn');
    if (current.role === Role.CUSTOMER && booking.customerId !== current.sub) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) throw new ForbiddenException();
    return this.dataSource.getRepository(HandoverRecord).find({
      where: { bookingId }, relations: { images: true }, order: { id: 'ASC' },
    });
  }
}
