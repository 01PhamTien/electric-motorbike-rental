import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryHealthMaintenance1795046400000 implements MigrationInterface {
  name='AddBatteryHealthMaintenance1795046400000';
  async up(q:QueryRunner):Promise<void>{
    if(!(await q.hasTable('battery_health_checks')))await q.query(`
      CREATE TABLE [battery_health_checks](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_health_checks] PRIMARY KEY,
        [batteryId] int NOT NULL,[stationId] int NOT NULL,[healthPercent] int NOT NULL,[cycleCount] int NOT NULL,
        [note] nvarchar(500) NULL,[recordedById] int NOT NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_health_checks_created] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_battery_health_checks_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_health_checks_user] FOREIGN KEY([recordedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_battery_health_checks_health] CHECK([healthPercent] BETWEEN 1 AND 100),
        CONSTRAINT [CK_battery_health_checks_cycles] CHECK([cycleCount]>=0)
      )`);
    if(!(await q.hasTable('battery_maintenance_tasks')))await q.query(`
      CREATE TABLE [battery_maintenance_tasks](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_maintenance_tasks] PRIMARY KEY,
        [batteryId] int NOT NULL,[stationId] int NOT NULL,[createdById] int NOT NULL,[completedById] int NULL,
        [taskType] varchar(40) NOT NULL,[priority] varchar(12) NOT NULL CONSTRAINT [DF_battery_maintenance_priority] DEFAULT 'NORMAL',
        [status] varchar(20) NOT NULL CONSTRAINT [DF_battery_maintenance_status] DEFAULT 'OPEN',
        [dueAt] datetime2 NULL,[description] nvarchar(1000) NOT NULL,[result] nvarchar(2000) NULL,
        [cost] decimal(12,2) NULL,[startedAt] datetime2 NULL,[completedAt] datetime2 NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_maintenance_created] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_battery_maintenance_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_maintenance_creator] FOREIGN KEY([createdById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_maintenance_completer] FOREIGN KEY([completedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_battery_maintenance_status] CHECK([status] IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
        CONSTRAINT [CK_battery_maintenance_priority] CHECK([priority] IN ('LOW','NORMAL','HIGH','URGENT')),
        CONSTRAINT [CK_battery_maintenance_cost] CHECK([cost] IS NULL OR [cost]>=0)
      )`);
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_health_checks_battery_created') CREATE INDEX [IDX_battery_health_checks_battery_created] ON [battery_health_checks]([batteryId],[createdAt])");
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_maintenance_station_status_due') CREATE INDEX [IDX_battery_maintenance_station_status_due] ON [battery_maintenance_tasks]([stationId],[status],[dueAt])");
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_maintenance_battery_created') CREATE INDEX [IDX_battery_maintenance_battery_created] ON [battery_maintenance_tasks]([batteryId],[createdAt])");
  }
  async down(q:QueryRunner):Promise<void>{
    if(await q.hasTable('battery_maintenance_tasks'))await q.dropTable('battery_maintenance_tasks');
    if(await q.hasTable('battery_health_checks'))await q.dropTable('battery_health_checks');
  }
}
