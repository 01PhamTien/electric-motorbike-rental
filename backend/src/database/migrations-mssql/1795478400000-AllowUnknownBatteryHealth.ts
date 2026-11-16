import { MigrationInterface, QueryRunner } from 'typeorm';

/** Allow a battery's health to remain unknown until an actual measurement is recorded. */
export class AllowUnknownBatteryHealth1795478400000 implements MigrationInterface {
  name = 'AllowUnknownBatteryHealth1795478400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('batteries'))) throw new Error('Table [batteries] does not exist.');
    const column = await queryRunner.query(`SELECT [is_nullable] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'[dbo].[batteries]') AND [name] = N'healthPercent'`);
    if (!column.length) throw new Error('Column [healthPercent] does not exist.');
    // Remove the old DEFAULT 100 so direct inserts cannot invent a health measurement.
    await queryRunner.query(`
      DECLARE @constraintName sysname;
      SELECT @constraintName = dc.[name]
      FROM sys.default_constraints dc
      INNER JOIN sys.columns c ON c.[object_id] = dc.[parent_object_id] AND c.[column_id] = dc.[parent_column_id]
      WHERE dc.[parent_object_id] = OBJECT_ID(N'[dbo].[batteries]') AND c.[name] = N'healthPercent';
      IF @constraintName IS NOT NULL
      BEGIN
        DECLARE @sql nvarchar(max);
        SET @sql = N'ALTER TABLE [dbo].[batteries] DROP CONSTRAINT ' + QUOTENAME(@constraintName);
        EXEC sp_executesql @sql;
      END
    `);
    if (column[0].is_nullable === false || column[0].is_nullable === 0) {
      await queryRunner.query('ALTER TABLE [dbo].[batteries] ALTER COLUMN [healthPercent] int NULL');
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('batteries'))) return;
    const unknown = await queryRunner.query('SELECT COUNT(*) AS [total] FROM [dbo].[batteries] WHERE [healthPercent] IS NULL');
    if (Number(unknown[0]?.total ?? 0) > 0) throw new Error('Record actual health measurements before reverting this migration.');
    await queryRunner.query('ALTER TABLE [dbo].[batteries] ALTER COLUMN [healthPercent] int NOT NULL');
    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.[object_id] = dc.[parent_object_id] AND c.[column_id] = dc.[parent_column_id]
        WHERE dc.[parent_object_id] = OBJECT_ID(N'[dbo].[batteries]') AND c.[name] = N'healthPercent'
      )
      ALTER TABLE [dbo].[batteries] ADD CONSTRAINT [DF_batteries_health] DEFAULT (100) FOR [healthPercent]
    `);
  }
}