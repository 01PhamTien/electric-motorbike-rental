import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Station } from '../stations/station.entity';
import { User } from '../users/user.entity';

export type StaffScheduleStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

@Entity('staff_schedules')
@Index('IDX_staff_schedules_staff_start', ['staffId', 'startAt'])
@Index('IDX_staff_schedules_station_start', ['stationId', 'startAt'])
export class StaffSchedule {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'staffId', foreignKeyConstraintName: 'FK_staff_schedules_staff' })
  staff: User;
  @Column({ type: 'int' }) staffId: number;

  @ManyToOne(() => Station, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'stationId', foreignKeyConstraintName: 'FK_staff_schedules_station' })
  station: Station;
  @Column({ type: 'int' }) stationId: number;

  @Column({ type: 'datetime2' }) startAt: Date;
  @Column({ type: 'datetime2' }) endAt: Date;
  @Column({ type: 'varchar', length: 20, default: 'PLANNED' }) status: StaffScheduleStatus;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) note: string | null;

  @Column({ type: 'int' }) createdById: number;
  @CreateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' }) createdAt: Date;
  @UpdateDateColumn({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' }) updatedAt: Date;
}
