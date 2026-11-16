import { MigrationInterface, QueryRunner } from 'typeorm';

/** Store VNPay checkout attempts separately from the verified payment ledger. */
export class CreateOnlinePaymentAttempts1795564800000 implements MigrationInterface {
  name = 'CreateOnlinePaymentAttempts1795564800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('online_payment_attempts')) {
      throw new Error('Table [online_payment_attempts] already exists; inspect it before applying this migration.');
    }
    if (!(await queryRunner.hasTable('bookings'))) {
      throw new Error('Cannot create online payment attempts: table [bookings] does not exist.');
    }
    await queryRunner.query(`
      CREATE TABLE [dbo].[online_payment_attempts] (
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_online_payment_attempts] PRIMARY KEY,
        [bookingId] int NOT NULL,
        [purpose] varchar(20) NOT NULL,
        [amount] decimal(12,2) NOT NULL,
        [idempotencyKey] varchar(100) NOT NULL,
        [txnRef] varchar(64) NOT NULL,
        [status] varchar(20) NOT NULL CONSTRAINT [DF_online_payment_attempts_status] DEFAULT ('PENDING'),
        [expiresAt] datetime2 NOT NULL,
        [vnpTransactionNo] varchar(30) NULL,
        [vnpResponseCode] varchar(2) NULL,
        [vnpBankCode] varchar(20) NULL,
        [vnpPayDate] varchar(14) NULL,
        [paidAt] datetime2 NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_online_payment_attempts_createdAt] DEFAULT (GETDATE()),
        CONSTRAINT [FK_online_payment_attempts_bookings] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_online_payment_attempts_purpose] CHECK ([purpose] IN ('DEPOSIT', 'RENT')),
        CONSTRAINT [CK_online_payment_attempts_status] CHECK ([status] IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
        CONSTRAINT [CK_online_payment_attempts_amount] CHECK ([amount] > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UX_online_payment_attempts_txnRef]
      ON [dbo].[online_payment_attempts]([txnRef])
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX [UX_online_payment_attempts_idempotencyKey]
      ON [dbo].[online_payment_attempts]([idempotencyKey])
    `);
    await queryRunner.query(`
      CREATE INDEX [IX_online_payment_attempts_booking_status]
      ON [dbo].[online_payment_attempts]([bookingId], [status])
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('online_payment_attempts'))) return;
    await queryRunner.query('DROP TABLE [dbo].[online_payment_attempts]');
  }
}
