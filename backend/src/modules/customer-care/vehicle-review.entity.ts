import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('vehicle_reviews')
@Check('CK_vehicle_reviews_rating', 'rating >= 1 AND rating <= 5')
@Index('UQ_vehicle_reviews_booking', ['bookingId'], { unique: true })
@Index('IDX_vehicle_reviews_vehicle_created', ['vehicleId', 'createdAt'])
export class VehicleReview {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Booking, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'bookingId', foreignKeyConstraintName: 'FK_vehicle_reviews_booking' }) booking: Booking;
  @Column({ type: 'int' }) bookingId: number;
  @ManyToOne(() => Vehicle, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_vehicle_reviews_vehicle' }) vehicle: Vehicle;
  @Column({ type: 'int' }) vehicleId: number;
  @ManyToOne(() => User, { eager: true, onDelete: 'NO ACTION' }) @JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'FK_vehicle_reviews_customer' }) customer: User;
  @Column({ type: 'int' }) customerId: number;
  @Column({ type: 'int' }) rating: number;
  @Column({ type: 'varchar', length: 1200, nullable: true }) comment: string | null;
  @CreateDateColumn() createdAt: Date;
}
