import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { PaymentPurpose, PaymentTransaction } from '../payments/payment.entity';
import { MaintenanceRecord, MaintenanceStatus } from '../maintenance/maintenance.entity';
import { OperatingCost, OperatingCostCategory } from '../operating-costs/operating-cost.entity';

type PaymentRow = Pick<PaymentTransaction, 'purpose' | 'amount' | 'createdAt'>;
const cents = (value: string | number) => Math.round(Number(value) * 100);
const money = (value: number) => Number((value / 100).toFixed(2));

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(PaymentTransaction) private readonly payments: Repository<PaymentTransaction>,
    @InjectRepository(MaintenanceRecord) private readonly maintenance: Repository<MaintenanceRecord>,
    @InjectRepository(OperatingCost) private readonly operatingCosts: Repository<OperatingCost>,
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
      .leftJoinAndSelect('booking.customer', 'customer')
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

    const [totalVehicles, activeVehicles, maintenanceVehicleCount, inactiveVehicles] = await Promise.all([
      this.vehicles.count(),
      this.vehicles.count({ where: { status: VehicleStatus.ACTIVE, isActive: true } }),
      this.vehicles.count({ where: { status: VehicleStatus.MAINTENANCE } }),
      this.vehicles.count({ where: { isActive: false } }),
    ]);

    // Fleet utilization is measured by booked hours overlapping the selected period,
    // not by booking creation date. Cancelled/expired bookings never occupy a vehicle.
    const utilizationStart = start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const utilizationEnd = end ?? new Date();
    const utilizationPeriodMs = Math.max(0, utilizationEnd.getTime() - utilizationStart.getTime());
    const utilizationQuery = this.bookings.createQueryBuilder('utilBooking')
      .where('utilBooking.pickupAt < :periodEnd', { periodEnd: utilizationEnd })
      .andWhere('utilBooking.returnAt > :periodStart', { periodStart: utilizationStart })
      .andWhere('utilBooking.status NOT IN (:...excluded)', {
        excluded: [BookingStatus.CANCELLED, BookingStatus.EXPIRED],
      });
    const utilizationBookings = await utilizationQuery.getMany();
    const utilizationByVehicle = new Map<number, { vehicleId:number; bookedMs:number; bookings:number }>();
    for (const booking of utilizationBookings) {
      const overlapStart = Math.max(new Date(booking.pickupAt).getTime(), utilizationStart.getTime());
      const overlapEnd = Math.min(new Date(booking.returnAt).getTime(), utilizationEnd.getTime());
      if (overlapEnd <= overlapStart) continue;
      const item = utilizationByVehicle.get(booking.vehicleId) ?? { vehicleId:booking.vehicleId, bookedMs:0, bookings:0 };
      item.bookedMs += overlapEnd - overlapStart;
      item.bookings += 1;
      utilizationByVehicle.set(booking.vehicleId, item);
    }
    const periodDays = utilizationPeriodMs / 86_400_000;
    const fleetCapacityMs = activeVehicles * utilizationPeriodMs;
    const totalBookedMs = [...utilizationByVehicle.values()].reduce((sum,item)=>sum+item.bookedMs,0);
    const utilizationVehicles = await this.vehicles.find({ where: { status: VehicleStatus.ACTIVE, isActive: true } });
    const fleetUtilization = {
      periodStart: utilizationStart.toISOString(),
      periodEnd: utilizationEnd.toISOString(),
      periodDays: Number(periodDays.toFixed(2)),
      activeFleetCount: activeVehicles,
      bookedVehicleDays: Number((totalBookedMs / 86_400_000).toFixed(2)),
      availableFleetDays: Number((activeVehicles * periodDays).toFixed(2)),
      utilizationRate: fleetCapacityMs > 0 ? Number((totalBookedMs / fleetCapacityMs * 100).toFixed(2)) : 0,
      idleFleetDays: Number(Math.max(0, activeVehicles * periodDays - totalBookedMs / 86_400_000).toFixed(2)),
      byVehicle: utilizationVehicles.map(vehicle => {
        const item = utilizationByVehicle.get(vehicle.id) ?? { vehicleId:vehicle.id, bookedMs:0, bookings:0 };
        const bookedDays = item.bookedMs / 86_400_000;
        return {
          vehicleId:vehicle.id, code:vehicle.code,
          bookedDays:Number(bookedDays.toFixed(2)),
          idleDays:Number(Math.max(0,periodDays-bookedDays).toFixed(2)),
          bookings:item.bookings,
          utilizationRate:periodDays>0?Number((bookedDays/periodDays*100).toFixed(2)):0,
        };
      }).sort((a,b)=>b.utilizationRate-a.utilizationRate).slice(0,10),
      note: 'Tỷ lệ dùng đội xe = tổng thời gian thuê giao nhau với kỳ báo cáo / (số xe đang hoạt động hiện tại × số ngày kỳ báo cáo). Số xe hoạt động là ảnh chụp hiện tại, không phải lịch sử đội xe.',
    };

    const maintenanceQuery = this.maintenance.createQueryBuilder('maintenance');
    maintenanceQuery.where('maintenance.status = :completed', { completed: MaintenanceStatus.COMPLETED });
    if (start) maintenanceQuery.andWhere('maintenance.completedAt >= :from', { from: start });
    if (end) maintenanceQuery.andWhere('maintenance.completedAt <= :to', { to: end });
    const maintenanceRows = await maintenanceQuery.getMany();
    const maintenanceByVehicle = new Map<number, { vehicleId:number; count:number; costCents:number }>();
    let maintenanceCostCents = 0;
    for (const record of maintenanceRows) {
      const cost = cents(record.cost);
      maintenanceCostCents += cost;
      const item = maintenanceByVehicle.get(record.vehicleId) ?? { vehicleId:record.vehicleId, count:0, costCents:0 };
      item.count += 1;
      item.costCents += cost;
      maintenanceByVehicle.set(record.vehicleId, item);
    }
    const maintenanceVehicleIds = [...maintenanceByVehicle.keys()];
    const maintenanceVehicles = maintenanceVehicleIds.length
      ? await this.vehicles.find({ where: maintenanceVehicleIds.map(id => ({ id })) })
      : [];
    const maintenanceVehicleMap = new Map(maintenanceVehicles.map(vehicle => [vehicle.id, vehicle]));
    const maintenanceByVehicleReport = [...maintenanceByVehicle.values()]
      .map(item => {
        const vehicle = maintenanceVehicleMap.get(item.vehicleId);
        return { vehicleId:item.vehicleId, code:vehicle?.code ?? 'Không xác định',
          station:vehicle?.station?.name ?? 'Không xác định', records:item.count, recordedCost:money(item.costCents) };
      })
      .sort((a,b) => b.recordedCost - a.recordedCost).slice(0,10);

    const operatingCostQuery = this.operatingCosts.createQueryBuilder('cost')
      .leftJoinAndSelect('cost.station', 'costStation')
      .leftJoinAndSelect('cost.vehicle', 'costVehicle');
    if (start) operatingCostQuery.andWhere('cost.occurredAt >= :from', { from: start });
    if (end) operatingCostQuery.andWhere('cost.occurredAt <= :to', { to: end });
    const operatingCostRows = await operatingCostQuery.getMany();
    const operatingCategoryTotals = new Map<OperatingCostCategory, number>();
    const operatingVehicleTotals = new Map<number, { vehicleId:number; code:string; amountCents:number; energyKwh:number; records:number }>();
    const operatingStationTotals = new Map<number, { stationId:number; name:string; amountCents:number; energyKwh:number; records:number }>();
    let operatingCostCents = 0;
    let chargingKwh = 0;
    for (const record of operatingCostRows) {
      const amount = cents(record.amount);
      operatingCostCents += amount;
      operatingCategoryTotals.set(record.category, (operatingCategoryTotals.get(record.category) ?? 0) + amount);
      const kwh = Number(record.energyKwh ?? 0);
      if (record.category === OperatingCostCategory.CHARGING) chargingKwh += kwh;
      if (record.vehicleId && record.vehicle) {
        const item = operatingVehicleTotals.get(record.vehicleId) ?? {
          vehicleId:record.vehicleId, code:record.vehicle.code, amountCents:0, energyKwh:0, records:0,
        };
        item.amountCents += amount;
        item.energyKwh += kwh;
        item.records += 1;
        operatingVehicleTotals.set(record.vehicleId,item);
      }
      const station = record.station;
      if (station) {
        const item = operatingStationTotals.get(station.id) ?? {
          stationId:station.id, name:station.name, amountCents:0, energyKwh:0, records:0,
        };
        item.amountCents += amount;
        item.energyKwh += kwh;
        item.records += 1;
        operatingStationTotals.set(station.id,item);
      }
    }
    const operatingCostReport = {
      totalCost: money(operatingCostCents),
      chargingKwh: Number(chargingKwh.toFixed(3)),
      records: operatingCostRows.length,
      byCategory: [...operatingCategoryTotals.entries()].map(([category,amount])=>({category,amount:money(amount)})).sort((a,b)=>b.amount-a.amount),
      byVehicle: [...operatingVehicleTotals.values()].map(item=>({
        vehicleId:item.vehicleId, code:item.code, amount:money(item.amountCents),
        energyKwh:Number(item.energyKwh.toFixed(3)), records:item.records,
      })).sort((a,b)=>b.amount-a.amount).slice(0,20),
      byStation: [...operatingStationTotals.values()].map(item=>({
        stationId:item.stationId, name:item.name, amount:money(item.amountCents),
        energyKwh:Number(item.energyKwh.toFixed(3)), records:item.records,
      })).sort((a,b)=>b.amount-a.amount),
      trackedCostTotal: money(operatingCostCents + maintenanceCostCents),
      contributionAfterTrackedCosts: money(rentCollected + extrasCollected - operatingCostCents - maintenanceCostCents),
      note: 'Chi phí đã theo dõi gồm phiếu bảo dưỡng hoàn thành và khoản vận hành đã ghi nhận. Chỉ số sau chi phí là phần đóng góp sau các chi phí đã nhập, chưa phải lợi nhuận ròng; chưa gồm lương, khấu hao, thuê mặt bằng, thuế và chi phí khác chưa ghi nhận.',
    };

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

    const customerStats = new Map<number, { customerId:number; name:string; createdAt:Date; bookings:number; completed:number; bookingValue:number; firstBookingAt:Date }>();
    let newCustomers = 0;
    for (const booking of bookingRows) {
      const customer = booking.customer;
      if (!customer || customer.role !== 'CUSTOMER') continue;
      const item = customerStats.get(customer.id) ?? {
        customerId: customer.id, name: customer.fullName, createdAt: new Date(customer.createdAt), bookings: 0, completed: 0,
        bookingValue: 0, firstBookingAt: booking.createdAt,
      };
      item.bookings += 1;
      if (booking.status === BookingStatus.COMPLETED) item.completed += 1;
      if (![BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) item.bookingValue += cents(booking.rentalAmount);
      if (booking.createdAt < item.firstBookingAt) item.firstBookingAt = booking.createdAt;
      customerStats.set(customer.id, item);
    }
    for (const item of customerStats.values()) {
      if ((!start || item.createdAt >= start) && (!end || item.createdAt <= end)) newCustomers += 1;
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
      maintenance: { completedRecords: maintenanceRows.length, recordedCost: money(maintenanceCostCents), byVehicle: maintenanceByVehicleReport },
      operatingCosts: operatingCostReport,
      fleetUtilization,
      monthly: months,
      topVehicles: [...vehicleStats.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 10).map(item => ({ ...item, bookingValue: money(item.bookingValue) })),
      stations: [...stationStats.values()].sort((a, b) => b.bookings - a.bookings).map(item => ({ ...item, bookingValue: money(item.bookingValue) })),
      notes: ['Đơn thuê và hiệu quả xe/trạm được lọc theo ngày tạo đơn.', 'Hiệu suất khai thác được tính theo thời gian thuê giao nhau với kỳ báo cáo; khi bỏ trống bộ lọc ngày, kỳ hiệu suất mặc định là từ đầu tháng hiện tại đến thời điểm lập báo cáo.', 'Dòng tiền dựa trên giao dịch thanh toán thủ công đã ghi nhận; không phải xác nhận giao dịch ngân hàng tự động.', 'Số tiền cọc đang giữ được tính lũy kế toàn hệ thống, không phụ thuộc khoảng thời gian báo cáo.'],
    };
  }
}
