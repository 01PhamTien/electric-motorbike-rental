import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum VehicleTransferStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('vehicle_transfers')
@Index(['sourceStationId', 'status'])
@Index(['destinationStationId', 'status'])
export class VehicleTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicleId: number;

  @Column({ type: 'int' })
  sourceStationId: number;

  @Column({ type: 'int' })
  destinationStationId: number;

  @Column({ type: 'int' })
  requestedById: number;

  @Column({ type: 'int', nullable: true })
  dispatchedById: number | null;

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

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;
}
