import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { User } from '../users/user.entity';
import { Booking } from './booking.entity';

@Entity('booking_status_histories')
export class BookingStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  bookingId: number;

  @Column({ type: 'simple-enum', enum: BookingStatus })
  fromStatus: BookingStatus;

  @Column({ type: 'simple-enum', enum: BookingStatus })
  toStatus: BookingStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedById' })
  performedBy: User | null;

  @Column({ type: 'int', nullable: true })
  performedById: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
