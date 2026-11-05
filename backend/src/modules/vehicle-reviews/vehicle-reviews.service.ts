import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { VehicleReview } from './vehicle-review.entity';
import { CreateVehicleReviewDto } from './dto';

@Injectable()
export class VehicleReviewsService {
  constructor(
    @InjectRepository(VehicleReview) private readonly reviews: Repository<VehicleReview>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
  ) {}

  async listForVehicle(vehicleId: number) {
    const rows = await this.reviews.find({ where: { vehicleId }, order: { createdAt: 'DESC' }, take: 50 });
    const aggregate = await this.reviews.createQueryBuilder('review')
      .select('COUNT(review.id)', 'total')
      .addSelect('AVG(review.rating)', 'averageRating')
      .where('review.vehicleId = :vehicleId', { vehicleId })
      .getRawOne<{ total: string; averageRating: string | null }>();
    return {
      items: rows,
      total: Number(aggregate?.total ?? 0),
      averageRating: aggregate?.averageRating == null ? null : Math.round(Number(aggregate.averageRating) * 10) / 10,
    };
  }

  async findForBooking(current: JwtUser, bookingId: number) {
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    if (booking.customerId !== current.sub) throw new ForbiddenException();
    return this.reviews.findOne({ where: { bookingId } });
  }

  async create(current: JwtUser, bookingId: number, dto: CreateVehicleReviewDto) {
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn thuê');
    if (booking.customerId !== current.sub) throw new ForbiddenException();
    if (booking.status !== BookingStatus.COMPLETED)
      throw new BadRequestException('Chỉ có thể đánh giá sau khi hoàn thành trả xe');
    const existing = await this.reviews.findOne({ where: { bookingId } });
    if (existing) throw new ConflictException('Đơn thuê này đã được đánh giá');
    try {
      return await this.reviews.save(this.reviews.create({
        bookingId, vehicleId: booking.vehicleId, customerId: current.sub,
        rating: dto.rating, comment: dto.comment?.trim() || null,
      }));
    } catch (error) {
      // The unique booking index also protects against simultaneous duplicate submissions.
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY' || (error as { number?: number })?.number === 2601 || (error as { number?: number })?.number === 2627)
        throw new ConflictException('Đơn thuê này đã được đánh giá');
      throw error;
    }
  }
}
