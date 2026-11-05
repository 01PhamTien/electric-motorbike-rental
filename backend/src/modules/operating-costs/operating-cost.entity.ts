import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

export enum OperatingCostCategory {
  CHARGING = 'CHARGING',
  CLEANING = 'CLEANING',
  INSURANCE = 'INSURANCE',
  REGISTRATION = 'REGISTRATION',
  PARKING = 'PARKING',
  OTHER = 'OTHER',
}

@Entity('operating_costs')
@Index('IDX_operating_costs_station_date', ['stationId', 'occurredAt'])
@Index('IDX_operating_costs_vehicle_date', ['vehicleId', 'occurredAt'])
export class OperatingCost {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Station, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'stationId', foreignKeyConstraintName: 'FK_operating_costs_stations' }) station: Station;
  @Column({ type: 'int' }) stationId: number;
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'SET NULL' })
  @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_operating_costs_vehicles' }) vehicle: Vehicle | null;
  @Column({ type: 'int', nullable: true }) vehicleId: number | null;
  @Column({ type: 'simple-enum', enum: OperatingCostCategory }) category: OperatingCostCategory;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: string;
  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true }) energyKwh: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) unitPrice: string | null;
  @Column({ type: 'datetime' }) occurredAt: Date;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;
  @ManyToOne(() => User, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' })
  @JoinColumn({ name: 'recordedById', foreignKeyConstraintName: 'FK_operating_costs_users' }) recordedBy: User;
  @Column({ type: 'int' }) recordedById: number;
  @CreateDateColumn() createdAt: Date;
}
