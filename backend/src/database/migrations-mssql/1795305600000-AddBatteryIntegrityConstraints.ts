import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforce the one-installed-battery-per-vehicle invariant in SQL Server.
 * Existing rows are checked first; this migration never repairs or deletes inventory.
 */
export class AddBatteryIntegrityConstraints1795305600000 implements MigrationInterface {
  name = 'AddBatteryIntegrityConstraints1795305600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('batteries'))) {
      throw new Error('Cannot enforce battery integrity: table [batteries] does not exist.');
    }
    if (!(await queryRunner.hasTable('vehicles'))) {
      throw new Error('Cannot enforce battery integrity: table [vehicles] does not exist.');
    }

    const invalidRows = await queryRunner.query(`
      SELECT COUNT(*) AS [total]
      FROM [batteries]
      WHERE ([status] = 'INSTALLED' AND [vehicleId] IS NULL)
         OR ([status] <> 'INSTALLED' AND [vehicleId] IS NOT NULL)
    `);
    if (Number(invalidRows[0]?.total ?? 0) > 0) {
      throw new Error('Cannot enforce battery integrity: status and vehicleId assignments are inconsistent. Reconcile existing rows before retrying.');
    }

    const duplicateInstalled = await queryRunner.query(`
      SELECT COUNT(*) AS [total]
      FROM (
        SELECT [vehicleId] FROM [batteries]
        WHERE [status] = 'INSTALLED'
        GROUP BY [vehicleId] HAVING COUNT(*) > 1
      ) AS [duplicates]
    `);
    if (Number(duplicateInstalled[0]?.total ?? 0) > 0) {
      throw new Error('Cannot enforce battery integrity: a vehicle has multiple INSTALLED batteries. Reconcile duplicates before retrying.');
    }

    const crossStationInstalled = await queryRunner.query(`
      SELECT COUNT(*) AS [total]
      FROM [batteries] AS [b]
      INNER JOIN [vehicles] AS [v] ON [v].[id] = [b].[vehicleId]
      WHERE [b].[status] = 'INSTALLED' AND [b].[stationId] <> [v].[stationId]
    `);
    if (Number(crossStationInstalled[0]?.total ?? 0) > 0) {
      throw new Error('Cannot enforce battery integrity: installed batteries and their vehicles belong to different stations. Reconcile station assignments before retrying.');
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
      IF EXISTS (SELECT 1 FROM sys.indexes
        WHERE [name] = N'UX_batteries_one_installed_per_vehicle'
          AND [object_id] = OBJECT_ID(N'[dbo].[batteries]'))
      DROP INDEX [UX_batteries_one_installed_per_vehicle] ON [dbo].[batteries]
    `);
    await queryRunner.query(`
      IF EXISTS (SELECT 1 FROM sys.check_constraints
        WHERE [name] = N'CK_batteries_vehicle_status'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[batteries]'))
      ALTER TABLE [dbo].[batteries] DROP CONSTRAINT [CK_batteries_vehicle_status]
    `);
  }
}
