import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryStocktakes1794960000000 implements MigrationInterface {
  name='AddBatteryStocktakes1794960000000';
  async up(queryRunner:QueryRunner):Promise<void>{
    if(!(await queryRunner.hasTable('battery_stocktakes')))await queryRunner.query(`
      CREATE TABLE [battery_stocktakes](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_stocktakes] PRIMARY KEY,
        [stationId] int NOT NULL,[createdById] int NOT NULL,[completedById] int NULL,[approvedById] int NULL,
        [status] varchar(20) NOT NULL CONSTRAINT [DF_battery_stocktakes_status] DEFAULT 'OPEN',
        [note] nvarchar(500) NULL,[completedAt] datetime2 NULL,[approvedAt] datetime2 NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_stocktakes_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_battery_stocktakes_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_battery_stocktakes_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_stocktakes_creator] FOREIGN KEY([createdById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_stocktakes_completer] FOREIGN KEY([completedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_stocktakes_approver] FOREIGN KEY([approvedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_battery_stocktakes_status] CHECK([status] IN ('OPEN','COMPLETED','APPROVED'))
      )`);
    if(!(await queryRunner.hasTable('battery_stocktake_items')))await queryRunner.query(`
      CREATE TABLE [battery_stocktake_items](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_stocktake_items] PRIMARY KEY,
        [stocktakeId] int NOT NULL,[batteryId] int NULL,[serialSnapshot] varchar(80) NOT NULL,
        [systemStatus] varchar(20) NOT NULL,[systemVehicleId] int NULL,[exempt] bit NOT NULL CONSTRAINT [DF_battery_stocktake_items_exempt] DEFAULT 0,
        [countStatus] varchar(20) NOT NULL CONSTRAINT [DF_battery_stocktake_items_count] DEFAULT 'PENDING',
        [observedStatus] varchar(20) NULL,[note] nvarchar(500) NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_stocktake_items_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_battery_stocktake_items_stocktake] FOREIGN KEY([stocktakeId]) REFERENCES [battery_stocktakes]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_stocktake_items_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_battery_stocktake_items_count] CHECK([countStatus] IN ('PENDING','PRESENT','MISSING','EXTRA')),
        CONSTRAINT [CK_battery_stocktake_items_battery_count] CHECK(([batteryId] IS NULL AND [countStatus]='EXTRA') OR ([batteryId] IS NOT NULL AND [countStatus]<>'EXTRA'))
      )`);
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_stocktakes_station_status') CREATE INDEX [IDX_battery_stocktakes_station_status] ON [battery_stocktakes]([stationId],[status])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_stocktake_items_stocktake') CREATE INDEX [IDX_battery_stocktake_items_stocktake] ON [battery_stocktake_items]([stocktakeId])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_stocktake_items_battery') CREATE INDEX [IDX_battery_stocktake_items_battery] ON [battery_stocktake_items]([batteryId])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_battery_stocktakes_one_open_per_station') CREATE UNIQUE INDEX [UX_battery_stocktakes_one_open_per_station] ON [battery_stocktakes]([stationId]) WHERE [status]='OPEN'");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_battery_stocktake_items_serial') CREATE UNIQUE INDEX [UX_battery_stocktake_items_serial] ON [battery_stocktake_items]([stocktakeId],[serialSnapshot])");
  }
  async down(queryRunner:QueryRunner):Promise<void>{
    if(await queryRunner.hasTable('battery_stocktake_items'))await queryRunner.dropTable('battery_stocktake_items');
    if(await queryRunner.hasTable('battery_stocktakes'))await queryRunner.dropTable('battery_stocktakes');
  }
}
