import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) userId: number;
  @Column({ type: 'varchar', length: 40 }) type: string;
  @Column({ type: 'nvarchar', length: 160 }) title: string;
  @Column({ type: 'nvarchar', length: 1000 }) message: string;
  @Column({ type: 'int', nullable: true }) relatedBookingId: number | null;
  @Column({ type: 'datetime2', nullable: true }) readAt: Date | null;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
}
