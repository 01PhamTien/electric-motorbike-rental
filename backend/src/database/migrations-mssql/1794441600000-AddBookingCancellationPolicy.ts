import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingCancellationPolicy1794441600000 implements MigrationInterface {
  name = 'AddBookingCancellationPolicy1794441600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('bookings');
    if (!table?.findColumnByName('cancellationFeeAmount')) {
      await queryRunner.query("ALTER TABLE [bookings] ADD [cancellationFeeAmount] decimal(12,2) NOT NULL CONSTRAINT [DF_bookings_cancellationFeeAmount] DEFAULT 0");
    }
    if (!table?.findColumnByName('cancellationType')) {
      await queryRunner.query("ALTER TABLE [bookings] ADD [cancellationType] varchar(30) NULL");
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('bookings');
    if (table?.findColumnByName('cancellationType')) await queryRunner.query('ALTER TABLE [bookings] DROP COLUMN [cancellationType]');
    if (table?.findColumnByName('cancellationFeeAmount')) {
      await queryRunner.query('ALTER TABLE [bookings] DROP CONSTRAINT [DF_bookings_cancellationFeeAmount]');
      await queryRunner.query('ALTER TABLE [bookings] DROP COLUMN [cancellationFeeAmount]');
    }
  }
}
