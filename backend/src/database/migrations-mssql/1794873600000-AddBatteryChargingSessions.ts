import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryChargingSessions1794873600000 implements MigrationInterface {
  name='AddBatteryChargingSessions1794873600000';
  async up(queryRunner:QueryRunner):Promise<void>{
    if(!(await queryRunner.hasTable('battery_charging_sessions'))){
      await queryRunner.query(`
        CREATE TABLE [battery_charging_sessions](
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_charging_sessions] PRIMARY KEY,
          [batteryId] int NOT NULL,
          [stationId] int NOT NULL,
          [startedById] int NOT NULL,
          [completedById] int NULL,
          [startedAt] datetime2 NOT NULL,
          [completedAt] datetime2 NULL,
          [status] varchar(20) NOT NULL CONSTRAINT [DF_battery_charging_sessions_status] DEFAULT 'IN_PROGRESS',
          [note] nvarchar(500) NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_charging_sessions_createdAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_battery_charging_sessions_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_charging_sessions_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_charging_sessions_started_by] FOREIGN KEY([startedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_charging_sessions_completed_by] FOREIGN KEY([completedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_battery_charging_sessions_status] CHECK([status] IN ('IN_PROGRESS','COMPLETED','CANCELLED')),
          CONSTRAINT [CK_battery_charging_sessions_completion] CHECK(([status]='IN_PROGRESS' AND [completedAt] IS NULL) OR ([status]<>'IN_PROGRESS' AND [completedAt] IS NOT NULL))
        )
      `);
    }
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_charging_sessions_battery_status') CREATE INDEX [IDX_battery_charging_sessions_battery_status] ON [battery_charging_sessions]([batteryId],[status])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_charging_sessions_station_started') CREATE INDEX [IDX_battery_charging_sessions_station_started] ON [battery_charging_sessions]([stationId],[startedAt])");
  }
  async down(queryRunner:QueryRunner):Promise<void>{
    if(await queryRunner.hasTable('battery_charging_sessions')) await queryRunner.dropTable('battery_charging_sessions');
  }
}
