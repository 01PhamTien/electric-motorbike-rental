import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandoverMaintenanceFlag1795219200000 implements MigrationInterface {
  name = 'AddHandoverMaintenanceFlag1795219200000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('handover_records');
    if (!table) throw new Error('handover_records table does not exist');
    if (!table.columns.some(column => column.name === 'requiresMaintenance')) {
      await queryRunner.query("ALTER TABLE [handover_records] ADD [requiresMaintenance] bit NOT NULL CONSTRAINT [DF_handover_requiresMaintenance] DEFAULT (0)");
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('handover_records');
    if (table?.columns.some(column => column.name === 'requiresMaintenance')) {
      await queryRunner.query('ALTER TABLE [handover_records] DROP CONSTRAINT [DF_handover_requiresMaintenance]');
      await queryRunner.query('ALTER TABLE [handover_records] DROP COLUMN [requiresMaintenance]');
    }
  }
}
