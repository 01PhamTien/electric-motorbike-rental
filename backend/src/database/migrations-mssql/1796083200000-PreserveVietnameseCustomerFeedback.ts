import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserve Unicode in customer-entered Vietnamese notes and reviews. */
export class PreserveVietnameseCustomerFeedback1796083200000 implements MigrationInterface {
  name = 'PreserveVietnameseCustomerFeedback1796083200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE [dbo].[booking_issues] ALTER COLUMN [description] nvarchar(2000) NOT NULL');
    await queryRunner.query('ALTER TABLE [dbo].[booking_issues] ALTER COLUMN [resolutionNote] nvarchar(1000) NULL');
    await queryRunner.query('ALTER TABLE [dbo].[vehicle_reviews] ALTER COLUMN [comment] nvarchar(1200) NULL');
    await queryRunner.query('ALTER TABLE [dbo].[bookings] ALTER COLUMN [cancelReason] nvarchar(255) NULL');
    await queryRunner.query('ALTER TABLE [dbo].[payment_transactions] ALTER COLUMN [note] nvarchar(255) NULL');
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Cannot safely revert Unicode text columns without risking Vietnamese data loss.');
  }
}
