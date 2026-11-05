import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatterySwap1794614400000 implements MigrationInterface {
  name='AddBatterySwap1794614400000';
  async up(queryRunner:QueryRunner):Promise<void>{
    if(!(await queryRunner.hasTable('batteries'))){
      await queryRunner.query(`
        CREATE TABLE [batteries](
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_batteries] PRIMARY KEY,
          [serialNumber] varchar(80) NOT NULL,
          [stationId] int NOT NULL,
          [vehicleId] int NULL,
          [status] varchar(20) NOT NULL CONSTRAINT [DF_batteries_status] DEFAULT 'FULL',
          [capacityKwh] decimal(8,2) NULL,
          [healthPercent] int NOT NULL CONSTRAINT [DF_batteries_health] DEFAULT 100,
          [cycleCount] int NOT NULL CONSTRAINT [DF_batteries_cycle] DEFAULT 0,
          [lastChargedAt] datetime2 NULL,
          [note] nvarchar(500) NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_batteries_createdAt] DEFAULT SYSUTCDATETIME(),
          [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_batteries_updatedAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_batteries_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_batteries_vehicle] FOREIGN KEY([vehicleId]) REFERENCES [vehicles]([id]) ON DELETE NO ACTION,
          CONSTRAINT [UQ_batteries_serial] UNIQUE([serialNumber]),
          CONSTRAINT [CK_batteries_status] CHECK([status] IN ('FULL','INSTALLED','CHARGING','MAINTENANCE','RETIRED')),
          CONSTRAINT [CK_batteries_health] CHECK([healthPercent] BETWEEN 1 AND 100),
          CONSTRAINT [CK_batteries_cycle] CHECK([cycleCount]>=0)
        )
      `);
    }
    if(!(await queryRunner.hasTable('battery_swaps'))){
      await queryRunner.query(`
        CREATE TABLE [battery_swaps](
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_swaps] PRIMARY KEY,
          [vehicleId] int NOT NULL,
          [stationId] int NOT NULL,
          [removedBatteryId] int NOT NULL,
          [installedBatteryId] int NOT NULL,
          [performedById] int NOT NULL,
          [note] nvarchar(500) NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_swaps_createdAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_battery_swaps_vehicle] FOREIGN KEY([vehicleId]) REFERENCES [vehicles]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_swaps_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_swaps_removed] FOREIGN KEY([removedBatteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_swaps_installed] FOREIGN KEY([installedBatteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_swaps_user] FOREIGN KEY([performedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_battery_swaps_distinct] CHECK([removedBatteryId]<>[installedBatteryId])
        )
      `);
    }
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_batteries_station_status') CREATE INDEX [IDX_batteries_station_status] ON [batteries]([stationId],[status])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_swaps_station_date') CREATE INDEX [IDX_battery_swaps_station_date] ON [battery_swaps]([stationId],[createdAt])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_swaps_vehicle_date') CREATE INDEX [IDX_battery_swaps_vehicle_date] ON [battery_swaps]([vehicleId],[createdAt])");
  }
  async down(queryRunner:QueryRunner):Promise<void>{
    if(await queryRunner.hasTable('battery_swaps')) await queryRunner.dropTable('battery_swaps');
    if(await queryRunner.hasTable('batteries')) await queryRunner.dropTable('batteries');
  }
}
