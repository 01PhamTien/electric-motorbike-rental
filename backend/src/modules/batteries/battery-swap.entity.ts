import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Battery } from './battery.entity';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { User } from '../users/user.entity';

@Entity('battery_swaps')
@Check('CK_battery_swaps_distinct', '[removedBatteryId] <> [installedBatteryId]')
@Index('IDX_battery_swaps_station_date', ['stationId', 'createdAt'])
@Index('IDX_battery_swaps_vehicle_date', ['vehicleId', 'createdAt'])
export class BatterySwap {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Vehicle, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_battery_swaps_vehicle' }) vehicle: Vehicle;
  @Column({ type: 'int' }) vehicleId: number;
  @ManyToOne(() => Station, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'stationId', foreignKeyConstraintName: 'FK_battery_swaps_station' }) station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => Battery, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'removedBatteryId', foreignKeyConstraintName: 'FK_battery_swaps_removed' }) removedBattery: Battery;
  @Column({ type: 'int' }) removedBatteryId: number;
  @ManyToOne(() => Battery, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'installedBatteryId', foreignKeyConstraintName: 'FK_battery_swaps_installed' }) installedBattery: Battery;
  @Column({ type: 'int' }) installedBatteryId: number;
  @ManyToOne(() => User, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'performedById', foreignKeyConstraintName: 'FK_battery_swaps_user' }) performedBy: User;
  @Column({ type: 'int' }) performedById: number;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;
  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' }) createdAt: Date;
}
