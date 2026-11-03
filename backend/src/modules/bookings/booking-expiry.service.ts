import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BookingStatusHistory } from './booking-status-history.entity';
import { Booking } from './booking.entity';

/**
 * Periodically clears expired holds even when nobody tries to book that vehicle.
 * Uses the same vehicle -> booking locking order as BookingsService.
 * Safe to retry: only a PENDING booking can transition to EXPIRED.
 */
@Injectable()
export class BookingExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    const interval = Number(process.env.BOOKING_EXPIRY_INTERVAL_MS || 60_000);
    if (process.env.BOOKING_EXPIRY_ENABLED === 'false') return;
    if (!Number.isSafeInteger(interval) || interval < 1000) {
      this.logger.error('BOOKING_EXPIRY_INTERVAL_MS must be an integer >= 1000');
      return;
    }
    this.timer = setInterval(() => {
      void this.expireBatch().catch((error: unknown) => {
        this.logger.error('Booking expiry sweep failed', error instanceof Error ? error.stack : String(error));
      });
    }, interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expireBatch(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let expired = 0;
    try {
      // Bounded sweep: subsequent ticks handle backlogs without blocking requests.
      const candidates = await this.dataSource.getRepository(Booking).find({
        select: { id: true, vehicleId: true, holdExpiresAt: true },
        where: {
          status: BookingStatus.PENDING,
          holdExpiresAt: LessThanOrEqual(new Date()),
        },
        order: { holdExpiresAt: 'ASC' },
        take: 100,
      });

      for (const candidate of candidates) {
        const changed = await this.dataSource.transaction(async (manager) => {
          const vehicle = await manager.getRepository(Vehicle).findOne({
            where: { id: candidate.vehicleId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!vehicle) return false;

          const bookings = manager.getRepository(Booking);
          const booking = await bookings.findOne({
            where: { id: candidate.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!booking || booking.status !== BookingStatus.PENDING ||
              !booking.holdExpiresAt || booking.holdExpiresAt > new Date()) return false;

          booking.status = BookingStatus.EXPIRED;
          await bookings.save(booking);
          await manager.getRepository(BookingStatusHistory).save({
            bookingId: booking.id,
            fromStatus: BookingStatus.PENDING,
            toStatus: BookingStatus.EXPIRED,
            performedById: null,
            reason: 'Tự động hết hạn giữ chỗ',
          });
          return true;
        });
        if (changed) expired++;
      }
    } finally {
      this.running = false;
    }
    if (expired > 0) this.logger.log(`Expired ${expired} booking holds`);
    return expired;
  }
}
