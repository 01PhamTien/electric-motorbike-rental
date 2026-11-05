import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { Booking } from '../bookings/booking.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { BookingIssue, BookingIssueStatus } from './booking-issue.entity';
import { CreateBookingIssueDto, CreateVehicleReviewDto, UpdateBookingIssueDto } from './dto';
import { VehicleReview } from './vehicle-review.entity';

@Injectable()
export class CustomerCareService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(VehicleReview) private readonly reviews: Repository<VehicleReview>,
    @InjectRepository(BookingIssue) private readonly issues: Repository<BookingIssue>,
  ) {}

  async listVehicleReviews(vehicleId: number) {
    const vehicle = await this.ds.getRepository(Vehicle).findOneBy({ id: vehicleId });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    const items = await this.reviews.find({ where: { vehicleId }, order: { createdAt: 'DESC' }, take: 100 });
    const averageRating = items.length ? Number((items.reduce((sum, item) => sum + item.rating, 0) / items.length).toFixed(1)) : null;
    return { items, total: items.length, averageRating };
  }

  async reviewForBooking(current: JwtUser, bookingId: number) {
    const booking = await this.ds.getRepository(Booking).findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    if (booking.customerId !== current.sub || current.role !== Role.CUSTOMER) throw new ForbiddenException();
    return this.reviews.findOne({ where: { bookingId } });
  }

  async createReview(current: JwtUser, bookingId: number, dto: CreateVehicleReviewDto) {
    if (current.role !== Role.CUSTOMER) throw new ForbiddenException();
    const booking = await this.ds.getRepository(Booking).findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    if (booking.customerId !== current.sub) throw new ForbiddenException();
    if (booking.status !== BookingStatus.COMPLETED) throw new BadRequestException('Chỉ có thể đánh giá sau khi đã hoàn tất trả xe');
    if (await this.reviews.exist({ where: { bookingId } })) throw new BadRequestException('Đơn thuê này đã được đánh giá');
    return this.reviews.save(this.reviews.create({
      bookingId, vehicleId: booking.vehicleId, customerId: current.sub,
      rating: dto.rating, comment: dto.comment?.trim() || null,
    }));
  }

  private async accessibleBooking(current: JwtUser, bookingId: number) {
    const booking = await this.ds.getRepository(Booking).findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    if (current.role === Role.CUSTOMER && booking.customerId !== current.sub) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId !== booking.vehicle.stationId) throw new ForbiddenException('Đơn ngoài điểm thuê được phân công');
    return booking;
  }

  async createIssue(current: JwtUser, bookingId: number, dto: CreateBookingIssueDto) {
    if (current.role !== Role.CUSTOMER) throw new ForbiddenException();
    const booking = await this.accessibleBooking(current, bookingId);
    if (booking.status !== BookingStatus.RENTING) throw new BadRequestException('Chỉ có thể báo sự cố trong thời gian đang thuê xe');
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) throw new BadRequestException('Cần gửi đủ cả vĩ độ và kinh độ');
    return this.issues.save(this.issues.create({
      bookingId, vehicleId: booking.vehicleId, customerId: current.sub,
      issueType: dto.issueType, severity: dto.severity, description: dto.description.trim(),
      latitude: dto.latitude === undefined ? null : String(dto.latitude),
      longitude: dto.longitude === undefined ? null : String(dto.longitude),
      status: BookingIssueStatus.OPEN, resolutionNote: null,
    }));
  }

  async listBookingIssues(current: JwtUser, bookingId: number) {
    await this.accessibleBooking(current, bookingId);
    return this.issues.find({ where: { bookingId }, order: { createdAt: 'DESC' } });
  }

  async listOperations(current: JwtUser) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    if (current.role === Role.STAFF && current.stationId == null) return [];
    return this.issues.find({
      where: current.role === Role.STAFF ? { vehicle: { stationId: current.stationId! } } : {},
      order: { createdAt: 'DESC' }, take: 200,
    });
  }

  async updateIssue(current: JwtUser, issueId: number, dto: UpdateBookingIssueDto) {
    if (![Role.ADMIN, Role.STAFF].includes(current.role)) throw new ForbiddenException();
    const issue = await this.issues.findOne({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Không tìm thấy báo cáo sự cố');
    if (current.role === Role.STAFF && current.stationId !== issue.vehicle.stationId) throw new ForbiddenException();
    if (dto.status === BookingIssueStatus.RESOLVED && !dto.resolutionNote?.trim()) {
      throw new BadRequestException('Cần ghi chú cách xử lý trước khi đóng sự cố');
    }
    issue.status = dto.status;
    if (dto.resolutionNote !== undefined) issue.resolutionNote = dto.resolutionNote.trim() || null;
    return this.issues.save(issue);
  }
}
