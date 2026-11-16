import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export function calculateRefundableDepositCents(input: {
  bookingStatus: BookingStatus;
  recordedDepositCents: number;
  recordedRefundCents: number;
  cancellationFeeCents: number;
}): number {
  const values = [input.recordedDepositCents, input.recordedRefundCents, input.cancellationFeeCents];
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new BadRequestException('Dữ liệu tiền cọc hoặc hoàn tiền không hợp lệ');
  }
  if (![BookingStatus.COMPLETED, BookingStatus.CANCELLED].includes(input.bookingStatus)) {
    throw new BadRequestException('Chỉ hoàn cọc sau khi hoàn tất hoặc hủy đơn');
  }
  return Math.max(0, input.recordedDepositCents - input.recordedRefundCents - input.cancellationFeeCents);
}
