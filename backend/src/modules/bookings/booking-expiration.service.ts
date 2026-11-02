import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Booking } from './booking.entity';
import { BookingStatusHistory } from './booking-status-history.entity';

@Injectable()
export class BookingExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpirationService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    // Run once on startup, then check every minute.
    void this.expirePendingBookings();
    this.timer = setInterval(() => {
      void this.expirePendingBookings();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expirePendingBookings(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.dataSource.transaction(async manager => {
        const now = new Date();
        const bookingRepo = manager.getRepository(Booking);
        const historyRepo = manager.getRepository(BookingStatusHistory);

        const expired = await bookingRepo.createQueryBuilder('booking')
          .setLock('pessimistic_write')
          .where('booking.status = :status', { status: BookingStatus.PENDING })
          .andWhere('booking.holdExpiresAt IS NOT NULL')
          .andWhere('booking.holdExpiresAt <= :now', { now })
          .orderBy('booking.holdExpiresAt', 'ASC')
          .take(100)
          .getMany();

        if (expired.length === 0) return 0;

        for (const booking of expired) {
          booking.status = BookingStatus.EXPIRED;
        }
        await bookingRepo.save(expired);

        await historyRepo.save(expired.map(booking => historyRepo.create({
          bookingId: booking.id,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.EXPIRED,
          performedById: null,
          reason: 'Tự động hết hạn giữ chỗ',
        })));

        this.logger.log(`Đã tự động chuyển ${expired.length} đơn sang EXPIRED.`);
        return expired.length;
      });
    } catch (error) {
      this.logger.error('Không thể tự động hết hạn đơn thuê.', error instanceof Error ? error.stack : String(error));
      return 0;
    } finally {
      this.running = false;
    }
  }
}
