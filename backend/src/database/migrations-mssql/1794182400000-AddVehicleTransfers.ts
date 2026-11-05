import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleTransfers1794182400000 implements MigrationInterface {
  name = 'AddVehicleTransfers1794182400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('vehicle_transfers')) return;
    await queryRunner.query(`CREATE TABLE [vehicle_transfers] (
      [id] int IDENTITY(1,1) NOT NULL,
      [vehicleId] int NOT NULL,
      [sourceStationId] int NOT NULL,
      [destinationStationId] int NOT NULL,
      [requestedById] int NOT NULL,
      [dispatchedById] int NULL,
      [receivedById] int NULL,
      [status] varchar(20) NOT NULL CONSTRAINT [DF_vehicle_transfers_status] DEFAULT 'PENDING',
      [note] nvarchar(500) NULL,
      [dispatchedAt] datetime2 NULL,
      [receivedAt] datetime2 NULL,
      [cancelledAt] datetime2 NULL,
      [createdAt] datetime2 NOT NULL CONSTRAINT [DF_vehicle_transfers_createdAt] DEFAULT SYSUTCDATETIME(),
      [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_vehicle_transfers_updatedAt] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_vehicle_transfers] PRIMARY KEY ([id]),
      CONSTRAINT [FK_vehicle_transfers_vehicle] FOREIGN KEY ([vehicleId]) REFERENCES [vehicles]([id]) ON DELETE NO ACTION,
      CONSTRAINT [FK_vehicle_transfers_source] FOREIGN KEY ([sourceStationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
      CONSTRAINT [FK_vehicle_transfers_destination] FOREIGN KEY ([destinationStationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
      CONSTRAINT [FK_vehicle_transfers_requestedBy] FOREIGN KEY ([requestedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
      CONSTRAINT [FK_vehicle_transfers_dispatchedBy] FOREIGN KEY ([dispatchedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
      CONSTRAINT [FK_vehicle_transfers_receivedBy] FOREIGN KEY ([receivedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
      CONSTRAINT [CK_vehicle_transfers_differentStations] CHECK ([sourceStationId] <> [destinationStationId]),
      CONSTRAINT [CK_vehicle_transfers_status] CHECK ([status] IN ('PENDING','IN_TRANSIT','COMPLETED','CANCELLED'))
    )`);
    await queryRunner.query('CREATE INDEX [IDX_vehicle_transfers_vehicle_status] ON [vehicle_transfers] ([vehicleId], [status])');
    await queryRunner.query('CREATE INDEX [IDX_vehicle_transfers_source_status] ON [vehicle_transfers] ([sourceStationId], [status])');
    await queryRunner.query('CREATE INDEX [IDX_vehicle_transfers_destination_status] ON [vehicle_transfers] ([destinationStationId], [status])');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('vehicle_transfers')) await queryRunner.query('DROP TABLE [vehicle_transfers]');
  }
}
