import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandoverInspection1794009600000 implements MigrationInterface {
  name = 'AddHandoverInspection1794009600000';
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('handover_records');
    if (!table) throw new Error('handover_records table does not exist');
    const columns = new Set(table.columns.map(column => column.name));
    if (!columns.has('inspectionChecklist')) await queryRunner.query('ALTER TABLE [handover_records] ADD [inspectionChecklist] nvarchar(max) NULL');
    if (!columns.has('damageNotes')) await queryRunner.query('ALTER TABLE [handover_records] ADD [damageNotes] nvarchar(1000) NULL');
    if (!columns.has('photoUrls')) await queryRunner.query('ALTER TABLE [handover_records] ADD [photoUrls] nvarchar(max) NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('handover_records');
    if (!table) return;
    const columns = new Set(table.columns.map(column => column.name));
    const existing = ['photoUrls', 'damageNotes', 'inspectionChecklist'].filter(name => columns.has(name));
    if (existing.length) await queryRunner.query('ALTER TABLE [handover_records] DROP COLUMN ' + existing.map(name => '[' + name + ']').join(', '));
  }
}