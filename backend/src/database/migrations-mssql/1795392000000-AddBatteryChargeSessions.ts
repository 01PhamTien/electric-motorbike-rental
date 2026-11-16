import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryChargeSessions1795392000000 implements MigrationInterface {
  name='AddBatteryChargeSessions1795392000000';
  async up(queryRunner:QueryRunner):Promise<void>{
    if(!(await queryRunner.hasTable('battery_charge_sessions'))){
      await queryRunner.query(`
        CREATE TABLE [battery_charge_sessions](
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_charge_sessions] PRIMARY KEY,
          [batteryId] int NOT NULL,
          [stationId] int NOT NULL,
          [startedById] int NULL,
          [completedById] int NULL,
          [startedAt] datetime2 NOT NULL,
          [completedAt] datetime2 NULL,
          [startNote] nvarchar(500) NULL,
          [completionNote] nvarchar(500) NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_charge_sessions_createdAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_battery_charge_sessions_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_charge_sessions_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_charge_sessions_started_by] FOREIGN KEY([startedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_charge_sessions_completed_by] FOREIGN KEY([completedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_battery_charge_sessions_completed] CHECK([completedAt] IS NULL OR [completedAt] >= [startedAt])
        )
      `);
    }
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_charge_sessions_station_started') CREATE INDEX [IDX_battery_charge_sessions_station_started] ON [battery_charge_sessions]([stationId],[startedAt] DESC)");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_charge_sessions_battery_started') CREATE INDEX [IDX_battery_charge_sessions_battery_started] ON [battery_charge_sessions]([batteryId],[startedAt] DESC)");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_battery_charge_sessions_active') CREATE UNIQUE INDEX [UX_battery_charge_sessions_active] ON [battery_charge_sessions]([batteryId]) WHERE [completedAt] IS NULL");
    await queryRunner.query(`
      INSERT INTO [battery_charge_sessions]([batteryId],[stationId],[startedAt],[startNote])
      SELECT b.[id],b.[stationId],COALESCE(b.[updatedAt],b.[createdAt],SYSUTCDATETIME()),N'Phiên sạc được ghi nhận khi nâng cấp hệ thống'
      FROM [batteries] b
      WHERE b.[status]='CHARGING'
        AND NOT EXISTS(SELECT 1 FROM [battery_charge_sessions] s WHERE s.[batteryId]=b.[id] AND s.[completedAt] IS NULL)
    `);
  }
  async down(queryRunner:QueryRunner):Promise<void>{
    if(await queryRunner.hasTable('battery_charge_sessions')) await queryRunner.dropTable('battery_charge_sessions');
  }
}
