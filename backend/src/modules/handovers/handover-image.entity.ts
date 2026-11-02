import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { HandoverRecord } from './handover.entity';

@Entity('handover_images')
export class HandoverImage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => HandoverRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'handoverId' })
  handover: HandoverRecord;

  @Column({ type: 'int' })
  handoverId: number;

  @Column({ type: 'varchar', length: 2048 })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
