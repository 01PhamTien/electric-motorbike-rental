import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryTransfers1794873600000 implements MigrationInterface {
  name='AddBatteryTransfers1794873600000';
  async up(queryRunner:QueryRunner):Promise<void>{
    await queryRunner.query("IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_batteries_status') ALTER TABLE [batteries] DROP CONSTRAINT [CK_batteries_status]");
    await queryRunner.query("ALTER TABLE [batteries] ADD CONSTRAINT [CK_batteries_status] CHECK([status] IN ('FULL','INSTALLED','CHARGING','MAINTENANCE','RETIRED','TRANSFERRING'))");
    if(!(await queryRunner.hasTable('battery_transfers'))) await queryRunner.query(`
      CREATE TABLE [battery_transfers](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_transfers] PRIMARY KEY,
        [sourceStationId] int NOT NULL,[destinationStationId] int NOT NULL,[createdById] int NOT NULL,
        [dispatchedById] int NULL,[receivedById] int NULL,
        [status] varchar(20) NOT NULL CONSTRAINT [DF_battery_transfers_status] DEFAULT 'PENDING',
        [note] nvarchar(500) NULL,[dispatchedAt] datetime2 NULL,[receivedAt] datetime2 NULL,[cancelledAt] datetime2 NULL,
        [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_transfers_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_battery_transfers_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [FK_battery_transfers_source] FOREIGN KEY([sourceStationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_transfers_destination] FOREIGN KEY([destinationStationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_transfers_creator] FOREIGN KEY([createdById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_transfers_dispatcher] FOREIGN KEY([dispatchedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_transfers_receiver] FOREIGN KEY([receivedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
        CONSTRAINT [CK_battery_transfers_status] CHECK([status] IN ('PENDING','IN_TRANSIT','COMPLETED','CANCELLED')),
        CONSTRAINT [CK_battery_transfers_stations] CHECK([sourceStationId]<>[destinationStationId])
      )`);
    if(!(await queryRunner.hasTable('battery_transfer_items'))) await queryRunner.query(`
      CREATE TABLE [battery_transfer_items](
        [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_transfer_items] PRIMARY KEY,
        [transferId] int NOT NULL,[batteryId] int NOT NULL,
        CONSTRAINT [FK_battery_transfer_items_transfer] FOREIGN KEY([transferId]) REFERENCES [battery_transfers]([id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_battery_transfer_items_battery] FOREIGN KEY([batteryId]) REFERENCES [batteries]([id]) ON DELETE NO ACTION,
        CONSTRAINT [UQ_battery_transfer_items_transfer_battery] UNIQUE([transferId],[batteryId])
      )`);
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_transfers_source_status') CREATE INDEX [IDX_battery_transfers_source_status] ON [battery_transfers]([sourceStationId],[status])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_transfers_destination_status') CREATE INDEX [IDX_battery_transfers_destination_status] ON [battery_transfers]([destinationStationId],[status])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_transfer_items_battery') CREATE INDEX [IDX_battery_transfer_items_battery] ON [battery_transfer_items]([batteryId])");
  }
  async down(queryRunner:QueryRunner):Promise<void>{
    if(await queryRunner.hasTable('battery_transfer_items'))await queryRunner.dropTable('battery_transfer_items');
    if(await queryRunner.hasTable('battery_transfers'))await queryRunner.dropTable('battery_transfers');
    await queryRunner.query("IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_batteries_status') ALTER TABLE [batteries] DROP CONSTRAINT [CK_batteries_status]");
    await queryRunner.query("ALTER TABLE [batteries] ADD CONSTRAINT [CK_batteries_status] CHECK([status] IN ('FULL','INSTALLED','CHARGING','MAINTENANCE','RETIRED'))");
  }
}
