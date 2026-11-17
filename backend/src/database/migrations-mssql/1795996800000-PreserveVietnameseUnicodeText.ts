import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SQL Server varchar/text cannot reliably preserve Vietnamese characters.
 * This migration changes only human-readable columns; it does not guess or
 * overwrite values already damaged by a previous non-Unicode conversion.
 */
export class PreserveVietnameseUnicodeText1795996800000 implements MigrationInterface {
  name = 'PreserveVietnameseUnicodeText1795996800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE [dbo].[vehicle_models] ALTER COLUMN [specifications] nvarchar(MAX) NULL");
    await queryRunner.query("ALTER TABLE [dbo].[maintenance_records] ALTER COLUMN [reason] nvarchar(160) NOT NULL");
    await queryRunner.query("ALTER TABLE [dbo].[maintenance_records] ALTER COLUMN [description] nvarchar(MAX) NULL");
    await queryRunner.query("ALTER TABLE [dbo].[handover_records] ALTER COLUMN [conditionNote] nvarchar(1000) NOT NULL");
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Unicode text migration cannot be safely reversed to varchar/text without risking Vietnamese data loss.');
  }
}
