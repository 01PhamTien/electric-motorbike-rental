import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { User } from '../users/user.entity';

@Entity('booking_charges')
@Index(['bookingId', 'applyToDeposit'])
export class BookingCharge {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'bookingId' }) booking: Booking;
  @Column({ type: 'int' }) bookingId: number;
  @Column({ type: 'varchar', length: 40 }) category: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: string;
  @Column({ type: 'boolean', default: false }) applyToDeposit: boolean;
  @Column({ type: 'varchar', length: 500 }) reason: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'createdById' }) createdBy: User;
  @Column({ type: 'int' }) createdById: number;
  @CreateDateColumn() createdAt: Date;
}
