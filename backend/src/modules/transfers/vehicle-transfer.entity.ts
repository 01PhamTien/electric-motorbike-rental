import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

export enum VehicleTransferStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('vehicle_transfers')
@Check('CK_vehicle_transfers_differentStations', '[sourceStationId] <> [destinationStationId]')
@Check('CK_vehicle_transfers_status', "[status] IN ('PENDING','IN_TRANSIT','COMPLETED','CANCELLED')")
@Check('CK_vehicle_transfers_dispatchBattery', '[dispatchBatteryPercent] IS NULL OR [dispatchBatteryPercent] BETWEEN 0 AND 100')
@Check('CK_vehicle_transfers_receiveBattery', '[receiveBatteryPercent] IS NULL OR [receiveBatteryPercent] BETWEEN 0 AND 100')
@Check('CK_vehicle_transfers_dispatchOdo', '[dispatchOdometerKm] IS NULL OR [dispatchOdometerKm] >= 0')
@Check('CK_vehicle_transfers_receiveOdo', '[receiveOdometerKm] IS NULL OR [receiveOdometerKm] >= 0')
@Index('IDX_vehicle_transfers_vehicle_status', ['vehicleId', 'status'])
@Index('IDX_vehicle_transfers_source_status', ['sourceStationId', 'status'])
@Index('IDX_vehicle_transfers_destination_status', ['destinationStationId', 'status'])
export class VehicleTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehicle, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_vehicle_transfers_vehicle' }) vehicle: Vehicle;
  @Column({ type: 'int' })
  vehicleId: number;

  @ManyToOne(() => Station, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'sourceStationId', foreignKeyConstraintName: 'FK_vehicle_transfers_source' }) sourceStation: Station;
  @Column({ type: 'int' })
  sourceStationId: number;

  @ManyToOne(() => Station, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'destinationStationId', foreignKeyConstraintName: 'FK_vehicle_transfers_destination' }) destinationStation: Station;
  @Column({ type: 'int' })
  destinationStationId: number;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'requestedById', foreignKeyConstraintName: 'FK_vehicle_transfers_requestedBy' }) requestedBy: User;
  @Column({ type: 'int' })
  requestedById: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' }) @JoinColumn({ name: 'dispatchedById', foreignKeyConstraintName: 'FK_vehicle_transfers_dispatchedBy' }) dispatchedBy: User | null;
  @Column({ type: 'int', nullable: true })
  dispatchedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' }) @JoinColumn({ name: 'receivedById', foreignKeyConstraintName: 'FK_vehicle_transfers_receivedBy' }) receivedBy: User | null;
  @Column({ type: 'int', nullable: true })
  receivedById: number | null;

  @Column({ type: 'varchar', length: 20, default: VehicleTransferStatus.PENDING })
  status: VehicleTransferStatus;

  @Column({ type: 'nvarchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'datetime2', nullable: true })
  dispatchedAt: Date | null;

  @Column({ type: 'datetime2', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'datetime2', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'int', nullable: true }) dispatchBatteryPercent: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 1, nullable: true }) dispatchOdometerKm: string | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true }) dispatchConditionNote: string | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) dispatchChecklist: string | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true }) dispatchDamageNotes: string | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) dispatchPhotoUrls: string | null;

  @Column({ type: 'int', nullable: true }) receiveBatteryPercent: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 1, nullable: true }) receiveOdometerKm: string | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true }) receiveConditionNote: string | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) receiveChecklist: string | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true }) receiveDamageNotes: string | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) receivePhotoUrls: string | null;

  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  updatedAt: Date;
}
