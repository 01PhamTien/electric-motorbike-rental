import { BadRequestException } from '@nestjs/common';

export function assertPickupWindow(pickupAt: Date, returnAt: Date, now = new Date()): void {
  const pickupTime = pickupAt.getTime();
  const returnTime = returnAt.getTime();
  const currentTime = now.getTime();
  if (![pickupTime, returnTime, currentTime].every(Number.isFinite) || returnTime <= pickupTime) {
    throw new BadRequestException('Khoảng thời gian nhận và trả xe không hợp lệ');
  }
  if (currentTime < pickupTime) {
    throw new BadRequestException('Chưa đến thời gian nhận xe theo đơn thuê');
  }
  if (currentTime >= returnTime) {
    throw new BadRequestException('Đơn đã quá thời hạn trả dự kiến');
  }
}
