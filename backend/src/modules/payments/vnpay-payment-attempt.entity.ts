import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { PaymentPurpose } from './payment.entity';

export enum VnPayAttemptStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity('vnpay_payment_attempts')
@Index('UX_vnpay_attempts_txn_ref', ['txnRef'], { unique: true })
@Index('UX_vnpay_attempts_idempotency', ['idempotencyKey'], { unique: true })
@Index('IX_vnpay_attempts_booking_purpose_status', ['bookingId', 'purpose', 'status'])
export class VnPayPaymentAttempt {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_vnpay_payment_attempts' })
  id: number;

  @ManyToOne(() => Booking, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'bookingId', foreignKeyConstraintName: 'FK_vnpay_attempts_booking' })
  booking: Booking;

  @Column({ type: 'int' })
  bookingId: number;

  @Column({ type: 'int' })
  createdById: number;

  @Column({ type: 'varchar', length: 20 })
  purpose: PaymentPurpose;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 100 })
  txnRef: string;

  @Column({ type: 'varchar', length: 100 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 20, default: VnPayAttemptStatus.PENDING })
  status: VnPayAttemptStatus;

  @Column({ type: 'varchar', length: 10, nullable: true })
  responseCode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  transactionNo: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  bankCode: string | null;

  @Column({ type: 'varchar', length: 14, nullable: true })
  payDate: string | null;

  @Column({ type: 'datetime2' })
  expiresAt: Date;

  @Column({ type: 'datetime2', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;
}
