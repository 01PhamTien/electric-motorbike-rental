import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

export enum BatteryStatus {
  FULL = 'FULL',
  INSTALLED = 'INSTALLED',
  CHARGING = 'CHARGING',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
}

@Entity('batteries')
@Index(['stationId', 'status'])
export class Battery {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 }) serialNumber: string;
  @ManyToOne(() => Station, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'stationId' }) station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'vehicleId' }) vehicle: Vehicle | null;
  @Column({ type: 'int', nullable: true }) vehicleId: number | null;
  @Column({ type: 'simple-enum', enum: BatteryStatus, default: BatteryStatus.FULL }) status: BatteryStatus;
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true }) capacityKwh: string | null;
  @Column({ type: 'int', default: 100 }) healthPercent: number;
  @Column({ type: 'int', default: 0 }) cycleCount: number;
  @Column({ type: 'datetime', nullable: true }) lastChargedAt: Date | null;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
