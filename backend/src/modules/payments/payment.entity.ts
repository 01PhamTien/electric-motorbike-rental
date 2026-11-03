import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
export enum PaymentPurpose { RENT = 'RENT', DEPOSIT = 'DEPOSIT', EXTRA = 'EXTRA', REFUND = 'REFUND' }
export enum PaymentMethod { CASH = 'CASH', TRANSFER = 'TRANSFER' }
@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'bookingId' }) booking: Booking;
  @Index() @Column({ type: 'int' }) bookingId: number;
  @Column({ type: 'simple-enum', enum: PaymentPurpose }) purpose: PaymentPurpose;
  @Column({ type: 'simple-enum', enum: PaymentMethod }) method: PaymentMethod;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) note: string | null;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 100 }) idempotencyKey: string;
  @Column({ type: 'int' }) recordedById: number;
  @CreateDateColumn() createdAt: Date;
}
