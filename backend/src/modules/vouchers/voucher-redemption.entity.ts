import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('voucher_redemptions')
@Index(['bookingId'], { unique: true })
@Index(['voucherId', 'customerId'])
export class VoucherRedemption {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) voucherId: number;
  @Column({ type: 'int' }) bookingId: number;
  @Column({ type: 'int' }) customerId: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) discountAmount: string;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
}
