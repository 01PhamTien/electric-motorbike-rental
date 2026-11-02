import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { VehicleStatus } from '../../common/enums/vehicle-status.enum';

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('maintenance_records')
@Index(['vehicleId', 'scheduledAt', 'plannedEndAt'])
export class MaintenanceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicleId: number;

  @Column({ type: 'datetime' })
  scheduledAt: Date;

  @Column({ type: 'datetime', nullable: true })
  plannedEndAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', length: 160 })
  reason: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cost: string;

  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.SCHEDULED })
  status: MaintenanceStatus;

  @Column({ type: 'enum', enum: VehicleStatus, nullable: true })
  previousVehicleStatus: VehicleStatus | null;

  @Column({ type: 'int' })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
