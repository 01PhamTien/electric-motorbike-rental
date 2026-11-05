import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { PaymentPurpose, PaymentTransaction } from '../payments/payment.entity';

type PaymentRow = Pick<PaymentTransaction, 'purpose' | 'amount' | 'createdAt'>;
const cents = (value: string | number) => Math.round(Number(value) * 100);
const money = (value: number) => Number((value / 100).toFixed(2));

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(PaymentTransaction) private readonly payments: Repository<PaymentTransaction>,
  ) {}

  private parseDate(value: string | undefined, name: string, end = false): Date | undefined {
    if (!value) return undefined;
    // Date-only filters are interpreted in the server's local business timezone.
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(value + (end ? 'T23:59:59.999+07:00' : 'T00:00:00+07:00'))
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Tham số ' + name + ' không hợp lệ');
    return parsed;
  }

  async getOverview(from?: string, to?: string) {
    const start = this.parseDate(from, 'from');
    const end = this.parseDate(to, 'to', true);
    if (start && end && start > end) throw new BadRequestException('from phải nhỏ hơn hoặc bằng to');

    const bookingQuery = this.bookings.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.vehicle', 'vehicle')
      .leftJoinAndSelect('vehicle.model', 'model')
      .leftJoinAndSelect('vehicle.station', 'station');
    if (start) bookingQuery.andWhere('booking.createdAt >= :from', { from: start });
    if (end) bookingQuery.andWhere('booking.createdAt <= :to', { to: end });
    const bookingRows = await bookingQuery.getMany();

    const bookingCounts = Object.values(BookingStatus).reduce((acc, status) => {
      acc[status] = bookingRows.filter(item => item.status === status).length;
      return acc;
    }, {} as Record<BookingStatus, number>);

    const paymentQuery = this.payments.createQueryBuilder('payment');
    if (start) paymentQuery.andWhere('payment.createdAt >= :from', { from: start });
    if (end) paymentQuery.andWhere('payment.createdAt <= :to', { to: end });
    const periodPayments: PaymentRow[] = await paymentQuery.getMany();

    // Deposit balances are lifetime balances; they must not be truncated by the selected reporting period.
    const allPaymentRows: PaymentRow[] = await this.payments.find({ select: { purpose: true, amount: true, createdAt: true } });
    const sumPurpose = (rows: PaymentRow[], purpose: PaymentPurpose) =>
      rows.filter(row => row.purpose === purpose).reduce((sum, row) => sum + cents(row.amount), 0);

    const rentCollected = sumPurpose(periodPayments, PaymentPurpose.RENT);
    const extrasCollected = sumPurpose(periodPayments, PaymentPurpose.EXTRA);
    const refundsInPeriod = sumPurpose(periodPayments, PaymentPurpose.REFUND);
    const depositCollected = sumPurpose(allPaymentRows, PaymentPurpose.DEPOSIT);
    const depositRefunded = sumPurpose(allPaymentRows, PaymentPurpose.REFUND);

    const [totalVehicles, activeVehicles, maintenanceVehicles, inactiveVehicles] = await Promise.all([
      this.vehicles.count(),
      this.vehicles.count({ where: { status: VehicleStatus.ACTIVE, isActive: true } }),
      this.vehicles.count({ where: { status: VehicleStatus.MAINTENANCE } }),
      this.vehicles.count({ where: { isActive: false } }),
    ]);

    const monthly = new Map<string, { rent: number; extra: number; refund: number; bookings: number }>();
    for (const row of periodPayments) {
      const date = new Date(row.createdAt);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const item = monthly.get(key) ?? { rent: 0, extra: 0, refund: 0, bookings: 0 };
      if (row.purpose === PaymentPurpose.RENT) item.rent += cents(row.amount);
      if (row.purpose === PaymentPurpose.EXTRA) item.extra += cents(row.amount);
      if (row.purpose === PaymentPurpose.REFUND) item.refund += cents(row.amount);
      monthly.set(key, item);
    }
    for (const booking of bookingRows) {
      const date = new Date(booking.createdAt);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const item = monthly.get(key) ?? { rent: 0, extra: 0, refund: 0, bookings: 0 };
      item.bookings += 1;
      monthly.set(key, item);
    }

    const vehicleStats = new Map<number, { vehicleId: number; code: string; model: string; station: string; bookings: number; completed: number; bookingValue: number }>();
    const stationStats = new Map<number, { stationId: number; name: string; bookings: number; completed: number; renting: number; bookingValue: number }>();
    for (const booking of bookingRows) {
      const vehicle = booking.vehicle;
      if (!vehicle) continue;
      const vehicleItem = vehicleStats.get(vehicle.id) ?? {
        vehicleId: vehicle.id, code: vehicle.code, model: vehicle.model?.name ?? 'Chưa phân loại',
        station: vehicle.station?.name ?? 'Chưa phân trạm', bookings: 0, completed: 0, bookingValue: 0,
      };
      vehicleItem.bookings += 1;
      if (booking.status === BookingStatus.COMPLETED) vehicleItem.completed += 1;
      if (![BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) vehicleItem.bookingValue += cents(booking.rentalAmount);
      vehicleStats.set(vehicle.id, vehicleItem);
      if (vehicle.station) {
        const stationItem = stationStats.get(vehicle.station.id) ?? {
          stationId: vehicle.station.id, name: vehicle.station.name, bookings: 0, completed: 0, renting: 0, bookingValue: 0,
        };
        stationItem.bookings += 1;
        if (booking.status === BookingStatus.COMPLETED) stationItem.completed += 1;
        if (booking.status === BookingStatus.RENTING) stationItem.renting += 1;
        if (![BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) stationItem.bookingValue += cents(booking.rentalAmount);
        stationStats.set(vehicle.station.id, stationItem);
      }
    }

    const customerStats = new Map<number, { customerId:number; name:string; bookings:number; completed:number; bookingValue:number; firstBookingAt:Date }>();
    let newCustomers = 0;
    for (const booking of bookingRows) {
      const customer = booking.customer;
      if (!customer || customer.role !== 'CUSTOMER') continue;
      const item = customerStats.get(customer.id) ?? {
        customerId: customer.id, name: customer.fullName, bookings: 0, completed: 0,
        bookingValue: 0, firstBookingAt: booking.createdAt,
      };
      item.bookings += 1;
      if (booking.status === BookingStatus.COMPLETED) item.completed += 1;
      if (![BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) item.bookingValue += cents(booking.rentalAmount);
      if (booking.createdAt < item.firstBookingAt) item.firstBookingAt = booking.createdAt;
      customerStats.set(customer.id, item);
    }
    for (const item of customerStats.values()) {
      const createdAt = (bookingRows.find(row => row.customer?.id === item.customerId)?.customer as any)?.createdAt;
      if (createdAt && (!start || new Date(createdAt) >= start) && (!end || new Date(createdAt) <= end)) newCustomers += 1;
    }
    const returningCustomers = [...customerStats.values()].filter(item => item.bookings > 1).length;
    const topCustomers = [...customerStats.values()]
      .sort((a, b) => b.bookings - a.bookings || b.bookingValue - a.bookingValue)
      .slice(0, 10)
      .map(item => ({ ...item, bookingValue: money(item.bookingValue), firstBookingAt: item.firstBookingAt.toISOString() }));

    const months = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, value]) => ({
      month, rentCollected: money(value.rent), extrasCollected: money(value.extra),
      refunds: money(value.refund), netCashIn: money(value.rent + value.extra - value.refund), bookings: value.bookings,
    }));

    return {
      generatedAt: new Date().toISOString(),
      filters: { from: start?.toISOString() ?? null, to: end?.toISOString() ?? null },
      bookings: { total: bookingRows.length, byStatus: bookingCounts },
      fleet: { total: totalVehicles, active: activeVehicles, maintenance: maintenanceVehicles, inactive: inactiveVehicles },
      finance: {
        rentCollected: money(rentCollected),
        extrasCollected: money(extrasCollected),
        refunds: money(refundsInPeriod),
        recognizedRevenue: money(rentCollected + extrasCollected),
        netCashIn: money(rentCollected + extrasCollected - refundsInPeriod),
        depositCollectedLifetime: money(depositCollected),
        depositRefundedLifetime: money(depositRefunded),
        depositHeldNow: money(depositCollected - depositRefunded),
        note: 'Doanh thu ghi nhận chỉ gồm tiền thuê và phụ phí đã thu; tiền cọc không tính là doanh thu. Hoàn cọc được trình bày riêng.',
      },
      customers: { uniqueInPeriod: customerStats.size, newInPeriod: newCustomers, returningInPeriod: returningCustomers, topCustomers },
      monthly: months,
      topVehicles: [...vehicleStats.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 10).map(item => ({ ...item, bookingValue: money(item.bookingValue) })),
      stations: [...stationStats.values()].sort((a, b) => b.bookings - a.bookings).map(item => ({ ...item, bookingValue: money(item.bookingValue) })),
      notes: ['Đơn thuê và hiệu quả xe/trạm được lọc theo ngày tạo đơn.', 'Dòng tiền dựa trên giao dịch thanh toán thủ công đã ghi nhận; không phải xác nhận giao dịch ngân hàng tự động.', 'Số tiền cọc đang giữ được tính lũy kế toàn hệ thống, không phụ thuộc khoảng thời gian báo cáo.'],
    };
  }
}
