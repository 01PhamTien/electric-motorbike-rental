import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Battery } from './battery.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

@Entity('battery_charge_sessions')
@Check('CK_battery_charge_sessions_completed', '[completedAt] IS NULL OR [completedAt] >= [startedAt]')
@Index('IDX_battery_charge_sessions_station_started', ['stationId', 'startedAt'])
@Index('IDX_battery_charge_sessions_battery_started', ['batteryId', 'startedAt'])
export class BatteryChargeSession {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Battery, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'batteryId', foreignKeyConstraintName: 'FK_battery_charge_sessions_battery' })
  battery: Battery;
  @Column({ type: 'int' }) batteryId: number;
  @ManyToOne(() => Station, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'stationId', foreignKeyConstraintName: 'FK_battery_charge_sessions_station' })
  station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'startedById', foreignKeyConstraintName: 'FK_battery_charge_sessions_started_by' })
  startedBy: User | null;
  @Column({ type: 'int', nullable: true }) startedById: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'completedById', foreignKeyConstraintName: 'FK_battery_charge_sessions_completed_by' })
  completedBy: User | null;
  @Column({ type: 'int', nullable: true }) completedById: number | null;
  @Column({ type: 'datetime2' }) startedAt: Date;
  @Column({ type: 'datetime2', nullable: true }) completedAt: Date | null;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) startNote: string | null;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) completionNote: string | null;
  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' }) createdAt: Date;
}
