import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleTransferInspections1794268800000 implements MigrationInterface {
  name = 'AddVehicleTransferInspections1794268800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('vehicle_transfers'))) {
      throw new Error('vehicle_transfers must exist before transfer inspection fields can be added');
    }
    const columns = [
      ['dispatchBatteryPercent', 'int NULL'],
      ['dispatchOdometerKm', 'decimal(12,1) NULL'],
      ['dispatchConditionNote', 'nvarchar(1000) NULL'],
      ['dispatchChecklist', 'nvarchar(MAX) NULL'],
      ['dispatchDamageNotes', 'nvarchar(1000) NULL'],
      ['dispatchPhotoUrls', 'nvarchar(MAX) NULL'],
      ['receiveBatteryPercent', 'int NULL'],
      ['receiveOdometerKm', 'decimal(12,1) NULL'],
      ['receiveConditionNote', 'nvarchar(1000) NULL'],
      ['receiveChecklist', 'nvarchar(MAX) NULL'],
      ['receiveDamageNotes', 'nvarchar(1000) NULL'],
      ['receivePhotoUrls', 'nvarchar(MAX) NULL'],
    ] as const;
    for (const [name, definition] of columns) {
      const table = await queryRunner.getTable('vehicle_transfers');
      if (!table?.findColumnByName(name)) {
        await queryRunner.query(`ALTER TABLE [vehicle_transfers] ADD [${name}] ${definition}`);
      }
    }
    await queryRunner.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_vehicle_transfers_dispatchBattery')
        ALTER TABLE [vehicle_transfers] ADD CONSTRAINT [CK_vehicle_transfers_dispatchBattery]
        CHECK ([dispatchBatteryPercent] IS NULL OR [dispatchBatteryPercent] BETWEEN 0 AND 100);
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_vehicle_transfers_receiveBattery')
        ALTER TABLE [vehicle_transfers] ADD CONSTRAINT [CK_vehicle_transfers_receiveBattery]
        CHECK ([receiveBatteryPercent] IS NULL OR [receiveBatteryPercent] BETWEEN 0 AND 100);
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_vehicle_transfers_dispatchOdo')
        ALTER TABLE [vehicle_transfers] ADD CONSTRAINT [CK_vehicle_transfers_dispatchOdo]
        CHECK ([dispatchOdometerKm] IS NULL OR [dispatchOdometerKm] >= 0);
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_vehicle_transfers_receiveOdo')
        ALTER TABLE [vehicle_transfers] ADD CONSTRAINT [CK_vehicle_transfers_receiveOdo]
        CHECK ([receiveOdometerKm] IS NULL OR [receiveOdometerKm] >= 0);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('vehicle_transfers'))) return;
    await queryRunner.query(`
      ALTER TABLE [vehicle_transfers] DROP CONSTRAINT IF EXISTS [CK_vehicle_transfers_dispatchBattery];
      ALTER TABLE [vehicle_transfers] DROP CONSTRAINT IF EXISTS [CK_vehicle_transfers_receiveBattery];
      ALTER TABLE [vehicle_transfers] DROP CONSTRAINT IF EXISTS [CK_vehicle_transfers_dispatchOdo];
      ALTER TABLE [vehicle_transfers] DROP CONSTRAINT IF EXISTS [CK_vehicle_transfers_receiveOdo];
    `);
    for (const name of ['dispatchBatteryPercent','dispatchOdometerKm','dispatchConditionNote','dispatchChecklist','dispatchDamageNotes','dispatchPhotoUrls','receiveBatteryPercent','receiveOdometerKm','receiveConditionNote','receiveChecklist','receiveDamageNotes','receivePhotoUrls']) {
      const table = await queryRunner.getTable('vehicle_transfers');
      if (table?.findColumnByName(name)) await queryRunner.query(`ALTER TABLE [vehicle_transfers] DROP COLUMN [${name}]`);
    }
  }
}
