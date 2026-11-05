import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('audit_logs')
@Index('IDX_audit_logs_created', ['createdAt'])
@Index('IDX_audit_logs_target', ['targetType', 'targetId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' }) @JoinColumn({ name: 'actorId', foreignKeyConstraintName: 'FK_audit_logs_actor' }) actor: User | null;
  @Column({ type: 'int', nullable: true }) actorId: number | null;
  @Column({ type: 'varchar', length: 60 }) action: string;
  @Column({ type: 'varchar', length: 60 }) targetType: string;
  @Column({ type: 'int', nullable: true }) targetId: number | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) details: string | null;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
}
