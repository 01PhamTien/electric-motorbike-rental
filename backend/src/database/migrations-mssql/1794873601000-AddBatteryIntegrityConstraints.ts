import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces battery ownership invariants in SQL Server.
 *
 * The migration deliberately validates existing rows before adding constraints.
 * It never rewrites or deletes inventory data.
 */
export class AddBatteryIntegrityConstraints1794873601000 implements MigrationInterface {
  name = 'AddBatteryIntegrityConstraints1794873601000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('batteries'))) {
      throw new Error('Cannot enforce battery integrity: table [batteries] does not exist.');
    }

    const invalidRows = await queryRunner.query(`
      SELECT COUNT(*) AS [total]
      FROM [batteries]
      WHERE ([status] = 'INSTALLED' AND [vehicleId] IS NULL)
         OR ([status] <> 'INSTALLED' AND [vehicleId] IS NOT NULL)
    `);
    if (Number(invalidRows[0]?.total ?? 0) > 0) {
      throw new Error(
        'Cannot add CK_batteries_vehicle_status: existing batteries have an invalid status/vehicleId combination. Review [batteries] before retrying.',
      );
    }

    const duplicateInstalled = await queryRunner.query(`
      SELECT COUNT(*) AS [total]
      FROM (
        SELECT [vehicleId]
        FROM [batteries]
        WHERE [status] = 'INSTALLED'
        GROUP BY [vehicleId]
        HAVING COUNT(*) > 1
      ) AS [duplicates]
    `);

    const crossStationInstalled = await queryRunner.query(`
      SELECT COUNT(*) AS [total]
      FROM [batteries] AS [b]
      INNER JOIN [vehicles] AS [v] ON [v].[id] = [b].[vehicleId]
      WHERE [b].[status] = 'INSTALLED'
        AND [b].[stationId] <> [v].[stationId]
    `);
    if (Number(crossStationInstalled[0]?.total ?? 0) > 0) {
      throw new Error(
        'Cannot enforce battery integrity: installed batteries and their vehicles belong to different stations. Reconcile station assignments before retrying.',
      );
    }
    if (Number(duplicateInstalled[0]?.total ?? 0) > 0) {
      throw new Error(
        'Cannot add UX_batteries_one_installed_per_vehicle: at least one vehicle has multiple INSTALLED batteries. Resolve duplicates before retrying.',
      );
    }

    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE [name] = N'CK_batteries_vehicle_status'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[batteries]')
      )
      ALTER TABLE [dbo].[batteries] WITH CHECK
      ADD CONSTRAINT [CK_batteries_vehicle_status]
      CHECK (
        ([status] = 'INSTALLED' AND [vehicleId] IS NOT NULL)
        OR ([status] <> 'INSTALLED' AND [vehicleId] IS NULL)
      )
    `);

    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE [name] = N'UX_batteries_one_installed_per_vehicle'
          AND [object_id] = OBJECT_ID(N'[dbo].[batteries]')
      )
      CREATE UNIQUE INDEX [UX_batteries_one_installed_per_vehicle]
      ON [dbo].[batteries]([vehicleId])
      WHERE [status] = 'INSTALLED' AND [vehicleId] IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('batteries'))) return;

    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE [name] = N'UX_batteries_one_installed_per_vehicle'
          AND [object_id] = OBJECT_ID(N'[dbo].[batteries]')
      )
      DROP INDEX [UX_batteries_one_installed_per_vehicle] ON [dbo].[batteries]
    `);

    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE [name] = N'CK_batteries_vehicle_status'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[batteries]')
      )
      ALTER TABLE [dbo].[batteries] DROP CONSTRAINT [CK_batteries_vehicle_status]
    `);
  }
}
