import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Voucher } from './voucher.entity';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';

@Entity('voucher_redemptions')
@Index('UQ_voucher_redemptions_booking', ['bookingId'], { unique: true })
@Index('IDX_voucher_redemptions_voucher_customer', ['voucherId', 'customerId'])
export class VoucherRedemption {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Voucher, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'voucherId', foreignKeyConstraintName: 'FK_voucher_redemptions_voucher' }) voucher: Voucher;
  @Column({ type: 'int' }) voucherId: number;
  @ManyToOne(() => Booking, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'bookingId', foreignKeyConstraintName: 'FK_voucher_redemptions_booking' }) booking: Booking;
  @Column({ type: 'int' }) bookingId: number;
  @ManyToOne(() => User, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'FK_voucher_redemptions_customer' }) customer: User;
  @Column({ type: 'int' }) customerId: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) discountAmount: string;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
}
