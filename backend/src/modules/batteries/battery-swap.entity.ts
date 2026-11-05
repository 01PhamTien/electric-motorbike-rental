import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Battery } from './battery.entity';
import { Station } from '../stations/station.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('battery_swaps')
@Index(['stationId', 'createdAt'])
@Index(['vehicleId', 'createdAt'])
export class BatterySwap {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Vehicle, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'vehicleId' }) vehicle: Vehicle;
  @Column({ type: 'int' }) vehicleId: number;
  @ManyToOne(() => Station, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'stationId' }) station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => Battery, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'removedBatteryId' }) removedBattery: Battery;
  @Column({ type: 'int' }) removedBatteryId: number;
  @ManyToOne(() => Battery, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'installedBatteryId' }) installedBattery: Battery;
  @Column({ type: 'int' }) installedBatteryId: number;
  @Column({ type: 'int' }) performedById: number;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;
  @CreateDateColumn() createdAt: Date;
}
