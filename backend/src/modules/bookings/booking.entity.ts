import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Voucher } from '../vouchers/voucher.entity';

@Entity('bookings')
@Index(['vehicleId', 'pickupAt', 'returnAt'])
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column()
  customerId: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.bookings, { eager: true })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: number;

  @Column({ type: 'datetime' })
  pickupAt: Date;

  @Column({ type: 'datetime' })
  returnAt: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  dailyRateSnapshot: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  depositSnapshot: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rentalAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  baseRentalAmount: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: string;

  @ManyToOne(() => Voucher, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'voucherId', foreignKeyConstraintName: 'FK_bookings_voucher' })
  voucher: Voucher | null;

  @Column({ type: 'int', nullable: true })
  voucherId: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  voucherCodeSnapshot: string | null;

  @Column({ type: 'datetime', nullable: true })
  holdExpiresAt: Date | null;

  @Column({ type: 'simple-enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelReason: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cancellationFeeAmount: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  cancellationType: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
