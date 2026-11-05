import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('maintenance_schedules')
@Index(['vehicleId'], { unique: true })
export class MaintenanceSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicleId: number;

  @Column({ type: 'int' })
  intervalKm: number;

  @Column({ type: 'int' })
  intervalDays: number;

  @Column({ type: 'int', default: 500 })
  warningKm: number;

  @Column({ type: 'int', default: 7 })
  warningDays: number;

  @Column({ type: 'decimal', precision: 12, scale: 1, default: 0 })
  lastServiceOdometerKm: string;

  @Column({ type: 'datetime2' })
  lastServiceAt: Date;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @Column({ type: 'int' })
  updatedById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
