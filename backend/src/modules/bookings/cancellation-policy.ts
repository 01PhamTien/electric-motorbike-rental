import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export type CancellationType = 'CUSTOMER_CANCELLED' | 'STAFF_CANCELLED' | 'NO_SHOW';
export const NO_SHOW_GRACE_PERIOD_MS = 30 * 60_000;
export const LATE_CANCELLATION_WINDOW_MS = 24 * 60 * 60_000;

/**
 * Fees are snapshots only. This function never creates a payment or refund.
 * Customer cancellation within 24 hours: 20% of rental, capped at the deposit.
 * No-show after the 30-minute grace period: 30% of rental, capped at the deposit.
 */
export function calculateCancellationFee(input: {
  type: CancellationType;
  bookingStatus: BookingStatus;
  rentalAmount: string | number;
  depositAmount: string | number;
  pickupAt: Date;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const pickupTime = input.pickupAt.getTime();
  const rentalCents = Math.max(0, Math.round(Number(input.rentalAmount) * 100));
  const depositCents = Math.max(0, Math.round(Number(input.depositAmount) * 100));

  if (input.type === 'NO_SHOW') {
    if (now.getTime() < pickupTime + NO_SHOW_GRACE_PERIOD_MS)
      throw new BadRequestException('Chỉ được ghi nhận No-show sau 30 phút kể từ giờ nhận xe');
    return Math.min(Math.round(rentalCents * 0.30), depositCents) / 100;
  }
  if (input.type === 'CUSTOMER_CANCELLED') {
    if (now.getTime() >= pickupTime)
      throw new BadRequestException('Đã đến giờ nhận xe. Vui lòng liên hệ nhân viên để được hỗ trợ');
    if (input.bookingStatus === BookingStatus.CONFIRMED &&
        pickupTime - now.getTime() < LATE_CANCELLATION_WINDOW_MS)
      return Math.min(Math.round(rentalCents * 0.20), depositCents) / 100;
  }
  return 0;
}
