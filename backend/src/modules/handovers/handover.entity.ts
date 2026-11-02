import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';

export enum HandoverKind { PICKUP = 'PICKUP', RETURN = 'RETURN' }
@Entity('handover_records')
@Index(['bookingId', 'kind'], { unique: true })
export class HandoverRecord {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'bookingId' }) booking: Booking;
  @Column({ type: 'int' }) bookingId: number;
  @Column({ type: 'enum', enum: HandoverKind }) kind: HandoverKind;
  @Column({ type: 'int' }) batteryPercent: number;
  @Column({ type: 'decimal', precision: 12, scale: 1 }) odometerKm: string;
  @Column({ type: 'varchar', length: 1000 }) conditionNote: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'staffId' }) staff: User;
  @Column({ type: 'int' }) staffId: number;
  @CreateDateColumn() createdAt: Date;
}
