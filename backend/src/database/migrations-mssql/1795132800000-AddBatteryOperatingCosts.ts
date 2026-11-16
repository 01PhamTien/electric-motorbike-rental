import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryOperatingCosts1795132800000 implements MigrationInterface {
  name='AddBatteryOperatingCosts1795132800000';
  async up(q:QueryRunner):Promise<void>{
    if(!(await q.hasTable('battery_operating_costs')))await q.query(`
      CREATE TABLE [battery_operating_costs](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_operating_costs] PRIMARY KEY,
        [batteryId] int NOT NULL,[stationId] int NOT NULL,[costType] varchar(20) NOT NULL,
        [amount] decimal(14,2) NOT NULL,[energyKwh] decimal(10,3) NULL,[unitPrice] decimal(12,2) NULL,
        [maintenanceTaskId] int NULL,[recordedById] int NOT NULL,[occurredAt] datetime2 NOT NULL,
        [note] nvarchar(500) NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_operating_costs_created] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_battery_cost_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_cost_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_cost_maintenance] FOREIGN KEY([maintenanceTaskId]) REFERENCES [battery_maintenance_tasks]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_cost_user] FOREIGN KEY([recordedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_battery_cost_type] CHECK([costType] IN ('CHARGING','MAINTENANCE','REPLACEMENT','OTHER')),
        CONSTRAINT [CK_battery_cost_amount] CHECK([amount]>=0),
        CONSTRAINT [CK_battery_cost_energy] CHECK([energyKwh] IS NULL OR [energyKwh]>=0),
        CONSTRAINT [CK_battery_cost_unit_price] CHECK([unitPrice] IS NULL OR [unitPrice]>=0),
        CONSTRAINT [CK_battery_cost_charging] CHECK([costType]<>'CHARGING' OR ([energyKwh] IS NOT NULL AND [unitPrice] IS NOT NULL))
      )`);
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_cost_station_occurred') CREATE INDEX [IDX_battery_cost_station_occurred] ON [battery_operating_costs]([stationId],[occurredAt])");
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_cost_battery_occurred') CREATE INDEX [IDX_battery_cost_battery_occurred] ON [battery_operating_costs]([batteryId],[occurredAt])");
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_cost_type_occurred') CREATE INDEX [IDX_battery_cost_type_occurred] ON [battery_operating_costs]([costType],[occurredAt])");
    await q.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_battery_cost_maintenance_task') CREATE UNIQUE INDEX [UX_battery_cost_maintenance_task] ON [battery_operating_costs]([maintenanceTaskId]) WHERE [maintenanceTaskId] IS NOT NULL");
  }
  async down(q:QueryRunner):Promise<void>{if(await q.hasTable('battery_operating_costs'))await q.dropTable('battery_operating_costs');}
}
