import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum VoucherDiscountType { PERCENT = 'PERCENT', FIXED = 'FIXED' }

@Entity('vouchers')
@Check('CK_vouchers_discountType', "[discountType] IN ('PERCENT','FIXED')")
@Check('CK_vouchers_discountValue', '[discountValue] > 0')
@Check('CK_vouchers_usage', '[usageCount] >= 0 AND ([usageLimit] IS NULL OR [usageLimit] >= [usageCount])')
@Check('CK_vouchers_dates', '[endsAt] > [startsAt]')
@Index(['code'], { unique: true })
export class Voucher {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 40 }) code: string;
  @Column({ type: 'varchar', length: 20 }) discountType: VoucherDiscountType;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) discountValue: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) maxDiscountAmount: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) minRentalAmount: string;
  @Column({ type: 'datetime2' }) startsAt: Date;
  @Column({ type: 'datetime2' }) endsAt: Date;
  @Column({ type: 'int', nullable: true }) usageLimit: number | null;
  @Column({ type: 'int', default: 1 }) perCustomerLimit: number;
  @Column({ type: 'int', default: 0 }) usageCount: number;
  @Column({ type: 'bit', default: true }) isActive: boolean;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) description: string | null;
  @CreateDateColumn({ type: 'datetime2' }) createdAt: Date;
  @UpdateDateColumn({ type: 'datetime2' }) updatedAt: Date;
}
