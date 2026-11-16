import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the payment method check constraint for verified VNPay ledger entries.
 * The previous constraint was generated for CASH and TRANSFER only.
 */
export class AddVnPayPaymentMethod1795564800001 implements MigrationInterface {
  name = 'AddVnPayPaymentMethod1795564800001';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment_transactions'))) {
      throw new Error('Cannot enable VNPay payment method: payment_transactions table does not exist.');
    }
    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CHK_04d87e39f56ad20b74e5315b3e_ENUM'
          AND parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
      )
        ALTER TABLE [dbo].[payment_transactions]
        DROP CONSTRAINT [CHK_04d87e39f56ad20b74e5315b3e_ENUM];
    `);
    if (!(await queryRunner.query(`
      SELECT 1 AS [found] FROM sys.check_constraints
      WHERE name = N'CHK_0adb86d5a0d5d0f782c5de9c50_ENUM'
        AND parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
    `)).length) {
      await queryRunner.query(`
        ALTER TABLE [dbo].[payment_transactions]
        ADD CONSTRAINT [CHK_0adb86d5a0d5d0f782c5de9c50_ENUM]
        CHECK ([method] IN ('CASH', 'TRANSFER', 'VNPAY'));
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment_transactions'))) return;
    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CHK_0adb86d5a0d5d0f782c5de9c50_ENUM'
          AND parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
      )
        ALTER TABLE [dbo].[payment_transactions]
        DROP CONSTRAINT [CHK_0adb86d5a0d5d0f782c5de9c50_ENUM];
    `);
    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CHK_04d87e39f56ad20b74e5315b3e_ENUM'
          AND parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
      )
        ALTER TABLE [dbo].[payment_transactions]
        ADD CONSTRAINT [CHK_04d87e39f56ad20b74e5315b3e_ENUM]
        CHECK ([method] IN ('CASH', 'TRANSFER'));
    `);
  }
}
