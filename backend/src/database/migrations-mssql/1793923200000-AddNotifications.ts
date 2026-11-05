import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1793923200000 implements MigrationInterface {
  name = 'AddNotifications1793923200000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('notifications')) return;
    await queryRunner.query(`CREATE TABLE [notifications] (
      [id] int IDENTITY(1,1) NOT NULL,
      [userId] int NOT NULL,
      [type] varchar(40) NOT NULL,
      [title] nvarchar(160) NOT NULL,
      [message] nvarchar(1000) NOT NULL,
      [relatedBookingId] int NULL,
      [readAt] datetime2 NULL,
      [createdAt] datetime2 NOT NULL CONSTRAINT [DF_notifications_createdAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_notifications] PRIMARY KEY ([id]),
      CONSTRAINT [FK_notifications_user] FOREIGN KEY ([userId]) REFERENCES [users]([id]) ON DELETE NO ACTION
    )`);
    await queryRunner.query('CREATE INDEX [IDX_notifications_user_created] ON [notifications] ([userId], [createdAt] DESC)');
    await queryRunner.query('CREATE INDEX [IDX_notifications_user_read] ON [notifications] ([userId], [readAt])');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('notifications')) await queryRunner.query('DROP TABLE [notifications]');
  }
}
