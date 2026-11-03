import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Station } from '../stations/station.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  fullName: string;

  @Index({ unique: true })
  @Column({ length: 160 })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'simple-enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Column({ type: 'simple-enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @ManyToOne(() => Station, (station) => station.staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stationId' })
  station: Station | null;

  @Column({ type: 'int', nullable: true })
  stationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
