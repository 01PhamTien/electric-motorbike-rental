import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('vehicle_reviews')
@Index(['bookingId'], { unique: true })
@Index(['vehicleId', 'createdAt'])
export class VehicleReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Booking, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'int' })
  bookingId: number;

  @ManyToOne(() => Vehicle, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ type: 'int' })
  vehicleId: number;

  @ManyToOne(() => User, { eager: true, onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', length: 1200, nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
