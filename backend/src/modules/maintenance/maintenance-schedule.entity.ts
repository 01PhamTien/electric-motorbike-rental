import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { User } from '../users/user.entity';

@Entity('maintenance_schedules')
@Index(['vehicleId'], { unique: true })
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
