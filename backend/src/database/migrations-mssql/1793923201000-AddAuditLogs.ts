import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogs1793923201000 implements MigrationInterface {
  name = 'AddAuditLogs1793923201000';
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('audit_logs')) return;
    await queryRunner.query(`CREATE TABLE [audit_logs] (
      [id] int IDENTITY(1,1) NOT NULL,
      [actorId] int NULL,
      [action] varchar(60) NOT NULL,
      [targetType] varchar(60) NOT NULL,
      [targetId] int NULL,
      [details] nvarchar(max) NULL,
      [createdAt] datetime2 NOT NULL CONSTRAINT [DF_audit_logs_createdAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_audit_logs] PRIMARY KEY ([id]),
      CONSTRAINT [FK_audit_logs_actor] FOREIGN KEY ([actorId]) REFERENCES [users]([id]) ON DELETE NO ACTION
    )`);
    await queryRunner.query('CREATE INDEX [IDX_audit_logs_created] ON [audit_logs] ([createdAt] DESC)');
    await queryRunner.query('CREATE INDEX [IDX_audit_logs_target] ON [audit_logs] ([targetType], [targetId], [createdAt] DESC)');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('audit_logs')) await queryRunner.query('DROP TABLE [audit_logs]');
  }
}
