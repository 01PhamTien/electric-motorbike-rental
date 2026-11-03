import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds editable image references without modifying existing model rows. */
export class AddVehicleModelImage1793664001000 implements MigrationInterface {
  name = 'AddVehicleModelImage1793664001000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('vehicle_models', 'imageUrl')) return;
    await queryRunner.query('ALTER TABLE `vehicle_models` ADD `imageUrl` varchar(500) NULL');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('vehicle_models', 'imageUrl'))) return;
    await queryRunner.query('ALTER TABLE `vehicle_models` DROP COLUMN `imageUrl`');
  }
}
