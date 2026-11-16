import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { PaymentPurpose } from './payment.entity';

export enum OnlinePaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity('online_payment_attempts')
@Index('UX_online_payment_attempts_txnRef', ['txnRef'], { unique: true })
@Index('IX_online_payment_attempts_booking_status', ['bookingId', 'status'])
export class OnlinePaymentAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Booking, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'int' })
  bookingId: number;

  @Column({ type: 'varchar', length: 20 })
  purpose: PaymentPurpose;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 100 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64 })
  txnRef: string;

  @Column({ type: 'varchar', length: 20, default: OnlinePaymentStatus.PENDING })
  status: OnlinePaymentStatus;

  @Column({ type: 'datetime2' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 30, nullable: true })
  vnpTransactionNo: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  vnpResponseCode: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vnpBankCode: string | null;

  @Column({ type: 'varchar', length: 14, nullable: true })
  vnpPayDate: string | null;

  @Column({ type: 'datetime2', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;
}
