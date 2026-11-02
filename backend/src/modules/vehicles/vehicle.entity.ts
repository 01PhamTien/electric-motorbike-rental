import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';
import { Station } from '../stations/station.entity';
import { VehicleModel } from '../vehicle-models/vehicle-model.entity';
import { Booking } from '../bookings/booking.entity';
import { VehicleLocation } from '../locations/vehicle-location.entity';
import { VehicleImage } from './vehicle-image.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 50 })
  code: string;

  @Index({ unique: true })
  @Column({ length: 30 })
  licensePlate: string;

  @ManyToOne(() => VehicleModel, (model) => model.vehicles, { eager: true })
  @JoinColumn({ name: 'modelId' })
  model: VehicleModel;

  @Column()
  modelId: number;

  @ManyToOne(() => Station, (station) => station.vehicles, { eager: true })
  @JoinColumn({ name: 'stationId' })
  station: Station;

  @Column()
  stationId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  dailyRate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  depositAmount: string;

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  status: VehicleStatus;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Booking, (booking) => booking.vehicle)
  bookings: Booking[];

  @OneToMany(() => VehicleLocation, (location) => location.vehicle)
  locations: VehicleLocation[];

  @OneToMany(() => VehicleImage, (image) => image.vehicle)
  images: VehicleImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
