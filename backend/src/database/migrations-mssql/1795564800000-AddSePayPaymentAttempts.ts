import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSePayPaymentAttempts1795564800000 implements MigrationInterface {
  name = 'AddSePayPaymentAttempts1795564800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payment_transactions'))) {
      throw new Error('Cannot enable SePay: payment_transactions table does not exist.');
    }
    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CHK_04d87e39f56ad20b74e5315b3e_ENUM'
          AND parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
      )
        ALTER TABLE [dbo].[payment_transactions]
        DROP CONSTRAINT [CHK_04d87e39f56ad20b74e5315b3e_ENUM];
      ALTER TABLE [dbo].[payment_transactions]
        ADD CONSTRAINT [CHK_04d87e39f56ad20b74e5315b3e_ENUM]
        CHECK ([method] IN ('CASH', 'TRANSFER', 'SEPAY'));
    `);
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.sepay_payment_attempts', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[sepay_payment_attempts] (
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_sepay_payment_attempts] PRIMARY KEY,
          [bookingId] int NOT NULL,
          [invoiceNumber] varchar(64) NOT NULL,
          [providerOrderId] varchar(64) NULL,
          [purpose] varchar(16) NOT NULL,
          [amount] decimal(12,2) NOT NULL,
          [status] varchar(16) NOT NULL CONSTRAINT [DF_sepay_attempt_status] DEFAULT ('PENDING'),
          [providerTransactionId] varchar(32) NULL,
          [paidAt] datetime2 NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_sepay_attempt_created] DEFAULT getdate(),
          [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_sepay_attempt_updated] DEFAULT getdate(),
          CONSTRAINT [FK_6d2cdafb292405e6e9f9f9ce2f4] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_sepay_attempt_purpose] CHECK ([purpose] IN ('RENT', 'DEPOSIT')),
          CONSTRAINT [CK_sepay_attempt_status] CHECK ([status] IN ('PENDING', 'PAID', 'VOID')),
          CONSTRAINT [CK_sepay_attempt_amount] CHECK ([amount] > 0)
        );
        CREATE UNIQUE INDEX [UQ_sepay_attempt_invoice] ON [dbo].[sepay_payment_attempts] ([invoiceNumber]);
        CREATE INDEX [IDX_sepay_attempt_booking_created] ON [dbo].[sepay_payment_attempts] ([bookingId], [createdAt]);
      END
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sepay_payment_attempts')) {
      const paid = await queryRunner.query(`SELECT COUNT(*) AS [total] FROM [dbo].[sepay_payment_attempts] WHERE [status] = 'PAID'`);
      if (Number(paid[0]?.total ?? 0) > 0) {
        throw new Error('Cannot remove SePay attempts after paid records exist; preserve payment audit history.');
      }
      await queryRunner.query('DROP TABLE [dbo].[sepay_payment_attempts]');
    }
    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CHK_04d87e39f56ad20b74e5315b3e_ENUM'
          AND parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
      )
        ALTER TABLE [dbo].[payment_transactions]
        DROP CONSTRAINT [CHK_04d87e39f56ad20b74e5315b3e_ENUM];
      ALTER TABLE [dbo].[payment_transactions]
        ADD CONSTRAINT [CHK_04d87e39f56ad20b74e5315b3e_ENUM]
        CHECK ([method] IN ('CASH', 'TRANSFER'));
    `);
  }
}
