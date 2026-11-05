import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';

export enum HandoverKind { PICKUP = 'PICKUP', RETURN = 'RETURN' }
@Entity('handover_records')
@Index(['bookingId', 'kind'], { unique: true })
export class HandoverRecord {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Booking, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' }) @JoinColumn({ name: 'bookingId' }) booking: Booking;
  @Column({ type: 'int' }) bookingId: number;
  @Column({ type: 'simple-enum', enum: HandoverKind }) kind: HandoverKind;
  @Column({ type: 'int' }) batteryPercent: number;
  @Column({ type: 'decimal', precision: 12, scale: 1 }) odometerKm: string;
  @Column({ type: 'varchar', length: 1000 }) conditionNote: string;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  inspectionChecklist: string | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  damageNotes: string | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  photoUrls: string | null;
  @ManyToOne(() => User, { onDelete: process.env.DB_TYPE === 'mssql' ? 'NO ACTION' : 'RESTRICT' }) @JoinColumn({ name: 'staffId' }) staff: User;
  @Column({ type: 'int' }) staffId: number;
  @CreateDateColumn() createdAt: Date;
}
