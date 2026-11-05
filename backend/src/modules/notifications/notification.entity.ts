import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('notifications')
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Index('IDX_notifications_user_read', ['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => User, { onDelete: 'NO ACTION' }) @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_notifications_user' }) user: User;
  @Column({ type: 'int' }) userId: number;
  @Column({ type: 'varchar', length: 40 }) type: string;
  @Column({ type: 'nvarchar', length: 160 }) title: string;
  @Column({ type: 'nvarchar', length: 1000 }) message: string;
  @Column({ type: 'int', nullable: true }) relatedBookingId: number | null;
  @Column({ type: 'datetime2', nullable: true }) readAt: Date | null;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
}
