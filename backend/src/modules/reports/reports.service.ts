import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
  ) {}

  async getOverview(from?: string, to?: string) {
    let range: { from?: Date; to?: Date } = {};
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
      notes: ['Số đơn được lọc theo thời điểm tạo đơn.', 'Báo cáo này chưa tính doanh thu; quy ước doanh thu, phụ phí và hoàn cọc cần được chốt riêng trước khi triển khai.'],
    };
  }
}
