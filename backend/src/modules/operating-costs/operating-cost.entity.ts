import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Station } from '../stations/station.entity';

export enum OperatingCostCategory {
  CHARGING = 'CHARGING',
  CLEANING = 'CLEANING',
  INSURANCE = 'INSURANCE',
  REGISTRATION = 'REGISTRATION',
  PARKING = 'PARKING',
  OTHER = 'OTHER',
}

@Entity('operating_costs')
@Index(['stationId', 'occurredAt'])
@Index(['vehicleId', 'occurredAt'])
export class OperatingCost {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Station, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'stationId' }) station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'SET NULL' })
  @JoinColumn({ name: 'vehicleId' }) vehicle: Vehicle | null;
  @Column({ type: 'int', nullable: true }) vehicleId: number | null;
  @Column({ type: 'simple-enum', enum: OperatingCostCategory }) category: OperatingCostCategory;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: string;
  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true }) energyKwh: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) unitPrice: string | null;
  @Column({ type: 'datetime' }) occurredAt: Date;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;
  @Column({ type: 'int' }) recordedById: number;
  @CreateDateColumn() createdAt: Date;
}
