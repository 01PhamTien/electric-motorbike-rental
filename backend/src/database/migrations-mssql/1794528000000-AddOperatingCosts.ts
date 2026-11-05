import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperatingCosts1794528000000 implements MigrationInterface {
  name = 'AddOperatingCosts1794528000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('operating_costs'))) {
      await queryRunner.query(`
        CREATE TABLE [operating_costs] (
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_operating_costs] PRIMARY KEY,
          [stationId] int NOT NULL,
          [vehicleId] int NULL,
          [category] varchar(30) NOT NULL,
          [amount] decimal(12,2) NOT NULL,
          [energyKwh] decimal(10,3) NULL,
          [unitPrice] decimal(12,2) NULL,
          [occurredAt] datetime2 NOT NULL,
          [note] nvarchar(500) NULL,
          [recordedById] int NOT NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_operating_costs_createdAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_operating_costs_stations] FOREIGN KEY ([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_operating_costs_vehicles] FOREIGN KEY ([vehicleId]) REFERENCES [vehicles]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_operating_costs_users] FOREIGN KEY ([recordedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_operating_costs_amount_positive] CHECK ([amount] > 0),
          CONSTRAINT [CK_operating_costs_energy_nonnegative] CHECK ([energyKwh] IS NULL OR [energyKwh] >= 0)
        )
      `);
    }
    await queryRunner.query("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IDX_operating_costs_station_date') CREATE INDEX [IDX_operating_costs_station_date] ON [operating_costs] ([stationId], [occurredAt])");
    await queryRunner.query("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IDX_operating_costs_vehicle_date') CREATE INDEX [IDX_operating_costs_vehicle_date] ON [operating_costs] ([vehicleId], [occurredAt])");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('operating_costs')) await queryRunner.dropTable('operating_costs');
  }
}
