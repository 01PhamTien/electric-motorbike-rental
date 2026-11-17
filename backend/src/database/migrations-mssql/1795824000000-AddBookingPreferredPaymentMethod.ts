import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingPreferredPaymentMethod1795824000000 implements MigrationInterface {
  name = 'AddBookingPreferredPaymentMethod1795824000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bookings'))) throw new Error('Cannot add preferred payment method: bookings table does not exist.');

    // Keep DDL in its own batch. SQL Server compiles a batch before executing it.
    await queryRunner.query(`
      IF COL_LENGTH(N'dbo.bookings', N'preferredPaymentMethod') IS NULL
      BEGIN
        ALTER TABLE [dbo].[bookings]
          ADD [preferredPaymentMethod] varchar(20) NOT NULL
          CONSTRAINT [DF_bookings_preferredPaymentMethod] DEFAULT ('CASH');
      END;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('bookings') && await queryRunner.hasColumn('bookings', 'preferredPaymentMethod')) {
      const nonCash = await queryRunner.query(`SELECT COUNT(*) AS [total] FROM [dbo].[bookings] WHERE [preferredPaymentMethod] <> 'CASH'`);
      if (Number(nonCash[0]?.total ?? 0) > 0) {
        throw new Error('Cannot remove preferred payment method while bookings contain non-cash preferences.');
      }
      await queryRunner.query(`
        DECLARE @constraintName sysname;
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bookings') AND c.name = N'preferredPaymentMethod';
        IF @constraintName IS NOT NULL EXEC(N'ALTER TABLE [dbo].[bookings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[bookings] DROP COLUMN [preferredPaymentMethod];
      `);
    }
  }
}
