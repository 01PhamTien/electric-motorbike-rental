import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingCharges1795651200000 implements MigrationInterface {
  name = 'AddBookingCharges1795651200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bookings'))) throw new Error('Cannot add booking charges: bookings table does not exist.');
    if (!(await queryRunner.hasTable('users'))) throw new Error('Cannot add booking charges: users table does not exist.');
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.booking_charges', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[booking_charges] (
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_booking_charges] PRIMARY KEY,
          [bookingId] int NOT NULL,
          [category] varchar(40) NOT NULL,
          [amount] decimal(12,2) NOT NULL,
          [applyToDeposit] bit NOT NULL CONSTRAINT [DF_booking_charges_applyToDeposit] DEFAULT (0),
          [reason] varchar(500) NOT NULL,
          [createdById] int NOT NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_booking_charges_createdAt] DEFAULT getdate(),
          CONSTRAINT [FK_87d3e6ca3989948eab01ac3f70f FOREIGN KEY ([bookingId]) REFERENCES [dbo].[bookings]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_9de199086e62e8c9913a3d26967 FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION,
          CONSTRAINT 
        );
        CREATE INDEX [IDX_07e831780a69939db20c724c44 ON [dbo].[booking_charges] ([bookingId], [applyToDeposit]);
      END
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('booking_charges')) {
      const count = await queryRunner.query('SELECT COUNT(*) AS [total] FROM [dbo].[booking_charges]');
      if (Number(count[0]?.total ?? 0) > 0) throw new Error('Cannot drop booking charges containing financial audit records.');
      await queryRunner.query('DROP TABLE [dbo].[booking_charges]');
    }
  }
}
