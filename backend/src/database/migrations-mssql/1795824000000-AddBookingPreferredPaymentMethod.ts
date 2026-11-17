import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingPreferredPaymentMethod1795824000000 implements MigrationInterface {
  name = 'AddBookingPreferredPaymentMethod1795824000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bookings'))) throw new Error('Cannot add preferred payment method: bookings table does not exist.');
    await queryRunner.query(`
      IF COL_LENGTH(N'dbo.bookings', N'preferredPaymentMethod') IS NULL
      BEGIN
        ALTER TABLE [dbo].[bookings]
          ADD [preferredPaymentMethod] varchar(20) NOT NULL
          CONSTRAINT [DF_bookings_preferredPaymentMethod] DEFAULT ('CASH');
      END;
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_bookings_preferredPaymentMethod')
      BEGIN
        ALTER TABLE [dbo].[bookings] WITH CHECK
          ADD CONSTRAINT [CK_bookings_preferredPaymentMethod]
          CHECK ([preferredPaymentMethod] IN ('CASH', 'TRANSFER', 'SEPAY'));
      END;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('bookings')) {
      const nonCash = await queryRunner.query(`SELECT COUNT(*) AS [total] FROM [dbo].[bookings] WHERE [preferredPaymentMethod] <> 'CASH'`);
      if (Number(nonCash[0]?.total ?? 0) > 0) {
        throw new Error('Cannot remove preferred payment method while bookings contain non-cash preferences.');
      }
      await queryRunner.query(`
        IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_bookings_preferredPaymentMethod')
          ALTER TABLE [dbo].[bookings] DROP CONSTRAINT [CK_bookings_preferredPaymentMethod];
        IF COL_LENGTH(N'dbo.bookings', N'preferredPaymentMethod') IS NOT NULL
        BEGIN
          DECLARE @constraintName sysname;
          SELECT @constraintName = dc.name
          FROM sys.default_constraints dc
          INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
          WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bookings') AND c.name = N'preferredPaymentMethod';
          IF @constraintName IS NOT NULL EXEC(N'ALTER TABLE [dbo].[bookings] DROP CONSTRAINT [' + @constraintName + N']');
          ALTER TABLE [dbo].[bookings] DROP COLUMN [preferredPaymentMethod];
        END;
      `);
    }
  }
}
