import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['createdAt'])
@Index(['targetType', 'targetId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int', nullable: true }) actorId: number | null;
  @Column({ type: 'varchar', length: 60 }) action: string;
  @Column({ type: 'varchar', length: 60 }) targetType: string;
  @Column({ type: 'int', nullable: true }) targetId: number | null;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) details: string | null;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
}
