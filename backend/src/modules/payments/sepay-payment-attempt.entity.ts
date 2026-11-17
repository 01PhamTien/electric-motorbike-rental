import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';

export enum SePayAttemptStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  VOID = 'VOID',
}

@Entity('sepay_payment_attempts')
@Check('CK_sepay_attempt_purpose', "[purpose] IN ('RENT', 'DEPOSIT', 'BOOKING')")
@Check('CK_sepay_attempt_status', "[status] IN ('PENDING', 'PAID', 'VOID')")
@Check('CK_sepay_attempt_amount', '[amount] > 0')
@Index('IDX_sepay_attempt_booking_created', ['bookingId', 'createdAt'])
@Index('UQ_sepay_attempt_invoice', ['invoiceNumber'], { unique: true })
export class SePayPaymentAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Booking, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'bookingId', foreignKeyConstraintName: 'FK_6d2cdafb292405e6e9f9f9ce2f4' })
  booking: Booking;

  @Column({ type: 'int' })
  bookingId: number;

  @Column({ type: 'varchar', length: 64 })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  providerOrderId: string | null;

  @Column({ type: 'varchar', length: 16 })
  purpose: 'RENT' | 'DEPOSIT' | 'BOOKING';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  rentAmount: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  depositAmount: string | null;

  @Column({ type: 'varchar', length: 16, default: SePayAttemptStatus.PENDING })
  status: SePayAttemptStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'datetime2', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
