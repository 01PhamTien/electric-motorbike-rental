import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVouchers1794355200000 implements MigrationInterface {
  name = 'AddVouchers1794355200000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('vouchers'))) {
      await queryRunner.query(`CREATE TABLE [vouchers] (
        [id] int IDENTITY(1,1) NOT NULL,
        [code] varchar(40) NOT NULL,
        [discountType] varchar(20) NOT NULL,
        [discountValue] decimal(12,2) NOT NULL,
        [maxDiscountAmount] decimal(12,2) NULL,
        [minRentalAmount] decimal(12,2) NOT NULL CONSTRAINT [DF_vouchers_minRentalAmount] DEFAULT 0,
        [startsAt] datetime2 NOT NULL,
        [endsAt] datetime2 NOT NULL,
        [usageLimit] int NULL,
        [perCustomerLimit] int NOT NULL CONSTRAINT [DF_vouchers_perCustomerLimit] DEFAULT 1,
        [usageCount] int NOT NULL CONSTRAINT [DF_vouchers_usageCount] DEFAULT 0,
        [isActive] bit NOT NULL CONSTRAINT [DF_vouchers_isActive] DEFAULT 1,
        [description] nvarchar(500) NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_vouchers_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_vouchers_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_vouchers] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_vouchers_code] UNIQUE ([code]),
        CONSTRAINT [CK_vouchers_discountType] CHECK ([discountType] IN ('PERCENT','FIXED')),
        CONSTRAINT [CK_vouchers_discountValue] CHECK ([discountValue] > 0),
        CONSTRAINT [CK_vouchers_usage] CHECK ([usageCount] >= 0 AND ([usageLimit] IS NULL OR [usageLimit] >= [usageCount])),
        CONSTRAINT [CK_vouchers_dates] CHECK ([endsAt] > [startsAt])
      )`);
    }
    if (!(await queryRunner.hasTable('voucher_redemptions'))) {
      await queryRunner.query(`CREATE TABLE [voucher_redemptions] (
        [id] int IDENTITY(1,1) NOT NULL,
        [voucherId] int NOT NULL,
        [bookingId] int NOT NULL,
        [customerId] int NOT NULL,
        [discountAmount] decimal(12,2) NOT NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_voucher_redemptions_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_voucher_redemptions] PRIMARY KEY ([id]),
        CONSTRAINT [FK_voucher_redemptions_voucher] FOREIGN KEY ([voucherId]) REFERENCES [vouchers]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_voucher_redemptions_booking] FOREIGN KEY ([bookingId]) REFERENCES [bookings]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_voucher_redemptions_customer] FOREIGN KEY ([customerId]) REFERENCES [users]([id]) ON DELETE NO ACTION
      )`);
      await queryRunner.query('CREATE UNIQUE INDEX [UQ_voucher_redemptions_booking] ON [voucher_redemptions] ([bookingId])');
      await queryRunner.query('CREATE INDEX [IDX_voucher_redemptions_voucher_customer] ON [voucher_redemptions] ([voucherId], [customerId])');
    }
    const table = await queryRunner.getTable('bookings');
    if (!table?.findColumnByName('baseRentalAmount')) {
      await queryRunner.query('ALTER TABLE [bookings] ADD [baseRentalAmount] decimal(12,2) NULL');
      await queryRunner.query('UPDATE [bookings] SET [baseRentalAmount] = [rentalAmount] WHERE [baseRentalAmount] IS NULL');
    }
    if (!table?.findColumnByName('discountAmount')) {
      await queryRunner.query('ALTER TABLE [bookings] ADD [discountAmount] decimal(12,2) NOT NULL CONSTRAINT [DF_bookings_discountAmount] DEFAULT 0');
    }
    if (!table?.findColumnByName('voucherId')) await queryRunner.query('ALTER TABLE [bookings] ADD [voucherId] int NULL');
    if (!table?.findColumnByName('voucherCodeSnapshot')) await queryRunner.query('ALTER TABLE [bookings] ADD [voucherCodeSnapshot] varchar(40) NULL');
    await queryRunner.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_bookings_voucher')
        ALTER TABLE [bookings] ADD CONSTRAINT [FK_bookings_voucher] FOREIGN KEY ([voucherId]) REFERENCES [vouchers]([id]) ON DELETE NO ACTION;
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('voucher_redemptions')) await queryRunner.query('DROP TABLE [voucher_redemptions]');
    if (await queryRunner.hasTable('bookings')) {
      await queryRunner.query('ALTER TABLE [bookings] DROP CONSTRAINT IF EXISTS [FK_bookings_voucher]');
      for (const name of ['voucherCodeSnapshot','voucherId','discountAmount','baseRentalAmount']) {
        const table = await queryRunner.getTable('bookings');
        if (table?.findColumnByName(name)) await queryRunner.query(`ALTER TABLE [bookings] DROP COLUMN [${name}]`);
      }
    }
    if (await queryRunner.hasTable('vouchers')) await queryRunner.query('DROP TABLE [vouchers]');
  }
}
