import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

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

  @Column({ type: 'datetime', nullable: true })
  holdExpiresAt: Date | null;

  @Column({ type: 'simple-enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
