import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatusHistory } from '../bookings/booking-status-history.entity';
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
      if (kind === HandoverKind.RETURN) {
        const pickup = await manager.getRepository(HandoverRecord).findOneBy({ bookingId, kind: HandoverKind.PICKUP });
        if (!pickup) throw new BadRequestException('Thiếu biên bản giao xe');
        if (dto.odometerKm < Number(pickup.odometerKm)) throw new BadRequestException('Số km trả không được nhỏ hơn lúc giao');
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
      return { bookingId, status: next, record };
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
