import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';
import { Vehicle } from '../vehicles/vehicle.entity';

export enum BookingIssueType { BREAKDOWN = 'BREAKDOWN', LOW_BATTERY = 'LOW_BATTERY', ACCIDENT = 'ACCIDENT', OTHER = 'OTHER' }
export enum BookingIssueSeverity { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' }
export enum BookingIssueStatus { OPEN = 'OPEN', IN_PROGRESS = 'IN_PROGRESS', RESOLVED = 'RESOLVED', CANCELLED = 'CANCELLED' }

@Entity('booking_issues')
@Check('CK_booking_issues_type', "issueType IN ('BREAKDOWN','LOW_BATTERY','ACCIDENT','OTHER')")
@Check('CK_booking_issues_severity', "severity IN ('LOW','MEDIUM','HIGH','CRITICAL')")
@Check('CK_booking_issues_status', "status IN ('OPEN','IN_PROGRESS','RESOLVED','CANCELLED')")
@Index('IDX_booking_issues_booking_created', ['bookingId', 'createdAt'])
@Index('IDX_booking_issues_status_created', ['status', 'createdAt'])
export class BookingIssue {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Booking, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'bookingId', foreignKeyConstraintName: 'FK_booking_issues_booking' }) booking: Booking;
  @Column({ type: 'int' }) bookingId: number;
  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'NO ACTION' }) @JoinColumn({ name: 'vehicleId', foreignKeyConstraintName: 'FK_booking_issues_vehicle' }) vehicle: Vehicle;
  @Column({ type: 'int' }) vehicleId: number;
  @ManyToOne(() => User, { eager: true, onDelete: 'NO ACTION' }) @JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'FK_booking_issues_customer' }) customer: User;
  @Column({ type: 'int' }) customerId: number;
  @Column({ type: 'varchar', length: 30 }) issueType: BookingIssueType;
  @Column({ type: 'varchar', length: 20 }) severity: BookingIssueSeverity;
  @Column({ type: 'varchar', length: 20, default: BookingIssueStatus.OPEN }) status: BookingIssueStatus;
  @Column({ type: 'varchar', length: 2000 }) description: string;
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true }) latitude: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true }) longitude: string | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) resolutionNote: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
