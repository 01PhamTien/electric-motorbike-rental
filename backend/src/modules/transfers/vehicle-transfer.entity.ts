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

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;
}
