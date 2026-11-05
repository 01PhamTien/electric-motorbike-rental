import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffSchedules1794787200000 implements MigrationInterface {
  name = 'AddStaffSchedules1794787200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('staff_schedules'))) {
      await queryRunner.query(`
        CREATE TABLE [staff_schedules] (
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_staff_schedules] PRIMARY KEY,
          [staffId] int NOT NULL,
          [stationId] int NOT NULL,
          [startAt] datetime2 NOT NULL,
          [endAt] datetime2 NOT NULL,
          [status] varchar(20) NOT NULL CONSTRAINT [DF_staff_schedules_status] DEFAULT 'PLANNED',
          [note] nvarchar(500) NULL,
          [createdById] int NOT NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_staff_schedules_createdAt] DEFAULT SYSUTCDATETIME(),
          [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_staff_schedules_updatedAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_staff_schedules_staff] FOREIGN KEY ([staffId]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_staff_schedules_station] FOREIGN KEY ([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_staff_schedules_created_by] FOREIGN KEY ([createdById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_staff_schedules_range] CHECK ([endAt] > [startAt] AND DATEDIFF(MINUTE, [startAt], [endAt]) <= 1440),
          CONSTRAINT [CK_staff_schedules_status] CHECK ([status] IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'))
        )
      `);
    }
    await queryRunner.query("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IDX_staff_schedules_staff_start') CREATE INDEX [IDX_staff_schedules_staff_start] ON [staff_schedules]([staffId],[startAt])");
    await queryRunner.query("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IDX_staff_schedules_station_start') CREATE INDEX [IDX_staff_schedules_station_start] ON [staff_schedules]([stationId],[startAt])");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('staff_schedules')) await queryRunner.dropTable('staff_schedules');
  }
}
