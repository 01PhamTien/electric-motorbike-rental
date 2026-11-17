import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCombinedSePayBookingCheckout1795910400000 implements MigrationInterface {
  name = 'AddCombinedSePayBookingCheckout1795910400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sepay_payment_attempts'))) {
      throw new Error('Cannot enable combined SePay checkout: sepay_payment_attempts table does not exist.');
    }
    await queryRunner.query(`
      IF COL_LENGTH(N'dbo.sepay_payment_attempts', N'rentAmount') IS NULL
        ALTER TABLE [dbo].[sepay_payment_attempts] ADD [rentAmount] decimal(12,2) NULL;
      IF COL_LENGTH(N'dbo.sepay_payment_attempts', N'depositAmount') IS NULL
        ALTER TABLE [dbo].[sepay_payment_attempts] ADD [depositAmount] decimal(12,2) NULL;
    `);
    await queryRunner.query(`
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_sepay_attempt_purpose' AND parent_object_id=OBJECT_ID(N'dbo.sepay_payment_attempts'))
        ALTER TABLE [dbo].[sepay_payment_attempts] DROP CONSTRAINT [CK_sepay_attempt_purpose];
      ALTER TABLE [dbo].[sepay_payment_attempts]
        ADD CONSTRAINT [CK_sepay_attempt_purpose] CHECK ([purpose] IN ('RENT','DEPOSIT','BOOKING'));
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_sepay_attempt_booking_allocation' AND parent_object_id=OBJECT_ID(N'dbo.sepay_payment_attempts'))
        ALTER TABLE [dbo].[sepay_payment_attempts] DROP CONSTRAINT [CK_sepay_attempt_booking_allocation];
      ALTER TABLE [dbo].[sepay_payment_attempts]
        ADD CONSTRAINT [CK_sepay_attempt_booking_allocation]
        CHECK (
          ([purpose] = 'BOOKING' AND [rentAmount] IS NOT NULL AND [depositAmount] IS NOT NULL
            AND [rentAmount] >= 0 AND [depositAmount] >= 0 AND [rentAmount] + [depositAmount] = [amount]
            AND [rentAmount] + [depositAmount] > 0)
          OR ([purpose] IN ('RENT','DEPOSIT') AND [rentAmount] IS NULL AND [depositAmount] IS NULL)
        );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sepay_payment_attempts'))) return;
    const combined = await queryRunner.query(`SELECT COUNT(*) AS [total] FROM [dbo].[sepay_payment_attempts] WHERE [purpose]='BOOKING'`);
    if (Number(combined[0]?.total ?? 0) > 0) {
      throw new Error('Cannot remove combined SePay allocation columns after combined checkout attempts exist; preserve payment audit history.');
    }
    await queryRunner.query(`
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_sepay_attempt_booking_allocation' AND parent_object_id=OBJECT_ID(N'dbo.sepay_payment_attempts'))
        ALTER TABLE [dbo].[sepay_payment_attempts] DROP CONSTRAINT [CK_sepay_attempt_booking_allocation];
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_sepay_attempt_purpose' AND parent_object_id=OBJECT_ID(N'dbo.sepay_payment_attempts'))
        ALTER TABLE [dbo].[sepay_payment_attempts] DROP CONSTRAINT [CK_sepay_attempt_purpose];
      ALTER TABLE [dbo].[sepay_payment_attempts]
        ADD CONSTRAINT [CK_sepay_attempt_purpose] CHECK ([purpose] IN ('RENT','DEPOSIT'));
      IF COL_LENGTH(N'dbo.sepay_payment_attempts', N'rentAmount') IS NOT NULL
        ALTER TABLE [dbo].[sepay_payment_attempts] DROP COLUMN [rentAmount];
      IF COL_LENGTH(N'dbo.sepay_payment_attempts', N'depositAmount') IS NOT NULL
        ALTER TABLE [dbo].[sepay_payment_attempts] DROP COLUMN [depositAmount];
    `);
  }
}
