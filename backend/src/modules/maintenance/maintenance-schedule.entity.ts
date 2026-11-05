import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { User } from '../users/user.entity';

@Entity('maintenance_schedules')
@Check('CK_maintenance_schedules_intervalKm', '[intervalKm] BETWEEN 100 AND 50000')
@Check('CK_maintenance_schedules_intervalDays', '[intervalDays] BETWEEN 1 AND 730')
@Unique('UQ_maintenance_schedules_vehicle', ['vehicleId'])
@Index('IDX_maintenance_schedules_active', ['isActive', 'vehicleId'])
export class MaintenanceSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_maintenance_schedules_vehicle' }) vehicle: Vehicle;
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

  @ManyToOne(() => User, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'updatedById', foreignKeyConstraintName: 'FK_maintenance_schedules_user' }) updatedBy: User;
  @Column({ type: 'int' })
  updatedById: number;

  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  updatedAt: Date;
}
