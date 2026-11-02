import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { PaymentPurpose, PaymentTransaction } from '../payments/payment.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(PaymentTransaction) private readonly payments: Repository<PaymentTransaction>,
  ) {}

  async getOverview(from?: string, to?: string) {
    const range: { from?: Date; to?: Date } = {};
    if (from) {
      const parsed = new Date(from);
      if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Tham số from không hợp lệ');
      range.from = parsed;
    }
    if (to) {
      const parsed = new Date(to);
      if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Tham số to không hợp lệ');
      range.to = parsed;
    }
    if (range.from && range.to && range.from > range.to) {
      throw new BadRequestException('from phải nhỏ hơn hoặc bằng to');
    }

    const bookingQuery = this.bookings.createQueryBuilder('booking');
    if (range.from) bookingQuery.andWhere('booking.createdAt >= :from', { from: range.from });
    if (range.to) bookingQuery.andWhere('booking.createdAt <= :to', { to: range.to });

    const bookingRows = await bookingQuery
      .select('booking.status', 'status')
      .addSelect('COUNT(booking.id)', 'count')
      .groupBy('booking.status')
      .getRawMany<{ status: BookingStatus; count: string }>();

    const bookingCounts = Object.values(BookingStatus).reduce((acc, status) => {
      const row = bookingRows.find((item) => item.status === status);
      acc[status] = Number(row?.count ?? 0);
      return acc;
    }, {} as Record<BookingStatus, number>);

    const [totalVehicles, activeVehicles, maintenanceVehicles, inactiveVehicles] = await Promise.all([
      this.vehicles.count(),
      this.vehicles.count({ where: { status: VehicleStatus.ACTIVE, isActive: true } }),
      this.vehicles.count({ where: { status: VehicleStatus.MAINTENANCE } }),
      this.vehicles.count({ where: { isActive: false } }),
    ]);

    const paymentQuery = this.payments.createQueryBuilder('payment');
    if (range.from) paymentQuery.andWhere('payment.createdAt >= :from', { from: range.from });
    if (range.to) paymentQuery.andWhere('payment.createdAt <= :to', { to: range.to });
    const paymentRaw = await paymentQuery
      .select('COUNT(payment.id)', 'count')
      .addSelect("COALESCE(SUM(CASE WHEN payment.purpose = 'RENT' THEN payment.amount ELSE 0 END), 0)", 'rentCollected')
      .addSelect("COALESCE(SUM(CASE WHEN payment.purpose = 'DEPOSIT' THEN payment.amount ELSE 0 END), 0)", 'depositCollected')
      .addSelect("COALESCE(SUM(CASE WHEN payment.purpose = 'EXTRA' THEN payment.amount ELSE 0 END), 0)", 'extraCollected')
      .addSelect("COALESCE(SUM(CASE WHEN payment.purpose = 'REFUND' THEN payment.amount ELSE 0 END), 0)", 'refunded')
      .getRawOne<{ count: string; rentCollected: string; depositCollected: string; extraCollected: string; refunded: string }>();

    const rentCollected = Number(paymentRaw?.rentCollected ?? 0);
    const depositCollected = Number(paymentRaw?.depositCollected ?? 0);
    const extraCollected = Number(paymentRaw?.extraCollected ?? 0);
    const refunded = Number(paymentRaw?.refunded ?? 0);
    const totalCollected = rentCollected + depositCollected + extraCollected;
    const netCashFlow = totalCollected - refunded;

    const utilizationQuery = this.bookings.createQueryBuilder('booking')
      .select('COUNT(DISTINCT booking.vehicleId)', 'vehiclesUsed')
      .addSelect("COALESCE(SUM(TIMESTAMPDIFF(MINUTE, booking.pickupAt, booking.returnAt)), 0)", 'scheduledMinutes')
      .where('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.RENTING, BookingStatus.COMPLETED],
      });
    if (range.from) utilizationQuery.andWhere('booking.createdAt >= :from', { from: range.from });
    if (range.to) utilizationQuery.andWhere('booking.createdAt <= :to', { to: range.to });
    const utilization = await utilizationQuery.getRawOne<{ vehiclesUsed: string; scheduledMinutes: string }>();

    const totalBookings = Object.values(bookingCounts).reduce((sum, value) => sum + value, 0);
    return {
      generatedAt: new Date().toISOString(),
      filters: { from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
      bookings: { total: totalBookings, byStatus: bookingCounts },
      fleet: {
        total: totalVehicles,
        active: activeVehicles,
        maintenance: maintenanceVehicles,
        inactive: inactiveVehicles,
      },
      payments: {
        transactionCount: Number(paymentRaw?.count ?? 0),
        rentCollected,
        depositCollected,
        extraCollected,
        refunded,
        totalCollected,
        netCashFlow,
      },
      utilization: {
        vehiclesUsed: Number(utilization?.vehiclesUsed ?? 0),
        scheduledMinutes: Number(utilization?.scheduledMinutes ?? 0),
      },
      notes: [
        'Số đơn được lọc theo thời điểm tạo đơn; giao dịch được lọc theo thời điểm ghi nhận.',
        'Tiền thuê, tiền cọc và phụ phí được trình bày riêng; tổng thu tiền mặt không đồng nghĩa doanh thu kế toán.',
        'Dòng tiền ròng = tổng giao dịch thu - tổng giao dịch hoàn; tiền cọc vẫn được theo dõi riêng.',
        'Mức sử dụng hiện thể hiện số xe có đơn CONFIRMED/RENTING/COMPLETED và tổng thời lượng thuê theo lịch, chưa phải tỷ lệ công suất.',
      ],
    };
  }
}
