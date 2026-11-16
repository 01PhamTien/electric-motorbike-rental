import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores checkout attempts separately from settled payment ledger entries. */
export class AddVnPayPaymentAttempts1795564800000 implements MigrationInterface {
  name = 'AddVnPayPaymentAttempts1795564800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bookings'))) {
      throw new Error('Cannot add VNPay payment attempts: bookings table does not exist.');
    }
    if (await queryRunner.hasTable('vnpay_payment_attempts')) {
      throw new Error('VNPay payment attempts table already exists; inspect migration history before continuing.');
    }
    await queryRunner.query(`
      CREATE TABLE [dbo].[vnpay_payment_attempts] (
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_vnpay_payment_attempts] PRIMARY KEY,
        [bookingId] int NOT NULL,
        [createdById] int NOT NULL,
        [purpose] varchar(20) NOT NULL,
        [amount] decimal(12,2) NOT NULL,
        [txnRef] varchar(100) NOT NULL,
        [idempotencyKey] varchar(100) NOT NULL,
        [status] varchar(20) NOT NULL CONSTRAINT [DF_vnpay_attempts_status] DEFAULT ('PENDING'),
        [responseCode] varchar(10) NULL,
        [transactionNo] varchar(50) NULL,
        [bankCode] varchar(30) NULL,
        [payDate] varchar(14) NULL,
        [expiresAt] datetime2 NOT NULL,
        [paidAt] datetime2 NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_vnpay_attempts_created] DEFAULT (GETDATE()),
        [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_vnpay_attempts_updated] DEFAULT (GETDATE()),
        CONSTRAINT [FK_vnpay_attempts_booking] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_vnpay_attempts_status] CHECK ([status] IN ('PENDING','PAID','FAILED','EXPIRED')),
        CONSTRAINT [CK_vnpay_attempts_amount] CHECK ([amount] > 0)
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX [UX_vnpay_attempts_txn_ref] ON [dbo].[vnpay_payment_attempts]([txnRef])');
    await queryRunner.query('CREATE UNIQUE INDEX [UX_vnpay_attempts_idempotency] ON [dbo].[vnpay_payment_attempts]([idempotencyKey])');
    await queryRunner.query('CREATE INDEX [IX_vnpay_attempts_booking_purpose_status] ON [dbo].[vnpay_payment_attempts]([bookingId],[purpose],[status])');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('vnpay_payment_attempts'))) return;
    await queryRunner.query('DROP TABLE [dbo].[vnpay_payment_attempts]');
  }
}
