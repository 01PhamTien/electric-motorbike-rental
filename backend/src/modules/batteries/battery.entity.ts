import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
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
@Check('CK_batteries_status', "[status] IN ('FULL','INSTALLED','CHARGING','MAINTENANCE','RETIRED')")
@Check('CK_batteries_health', '[healthPercent] BETWEEN 1 AND 100')
@Check('CK_batteries_cycle', '[cycleCount] >= 0')
@Index('IDX_batteries_station_status', ['stationId', 'status'])
@Unique('UQ_batteries_serial', ['serialNumber'])
export class Battery {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 80 }) serialNumber: string;
  @ManyToOne(() => Station, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'stationId', foreignKeyConstraintName: 'FK_batteries_station' }) station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_batteries_vehicle' }) vehicle: Vehicle | null;
  @Column({ type: 'int', nullable: true }) vehicleId: number | null;
  @Column({ type: 'varchar', length: 20, default: BatteryStatus.FULL }) status: BatteryStatus;
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true }) capacityKwh: string | null;
  @Column({ type: 'int', default: 100 }) healthPercent: number;
  @Column({ type: 'int', default: 0 }) cycleCount: number;
  @Column({ type: 'datetime2', nullable: true }) lastChargedAt: Date | null;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;
  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' }) createdAt: Date;
  @UpdateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' }) updatedAt: Date;
}
