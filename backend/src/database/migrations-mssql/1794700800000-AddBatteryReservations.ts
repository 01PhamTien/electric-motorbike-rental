import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatteryReservations1794700800000 implements MigrationInterface {
  name='AddBatteryReservations1794700800000';
  async up(queryRunner:QueryRunner):Promise<void>{
    if(!(await queryRunner.hasTable('battery_reservations'))){
      await queryRunner.query(`
        CREATE TABLE [battery_reservations](
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_battery_reservations] PRIMARY KEY,
          [customerId] int NOT NULL,
          [stationId] int NOT NULL,
          [bookingId] int NOT NULL,
          [vehicleId] int NOT NULL,
          [status] varchar(20) NOT NULL CONSTRAINT [DF_battery_reservations_status] DEFAULT 'RESERVED',
          [expiresAt] datetime2 NOT NULL,
          [redeemedAt] datetime2 NULL,
          [cancelledAt] datetime2 NULL,
          [redeemedById] int NULL,
          [batterySwapId] int NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_battery_reservations_createdAt] DEFAULT SYSUTCDATETIME(),
          [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_battery_reservations_updatedAt] DEFAULT SYSUTCDATETIME(),
          CONSTRAINT [FK_battery_reservations_customer] FOREIGN KEY([customerId]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_reservations_station] FOREIGN KEY([stationId]) REFERENCES [stations]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_reservations_booking] FOREIGN KEY([bookingId]) REFERENCES [bookings]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_reservations_vehicle] FOREIGN KEY([vehicleId]) REFERENCES [vehicles]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_reservations_redeemed_by] FOREIGN KEY([redeemedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
          CONSTRAINT [FK_battery_reservations_swap] FOREIGN KEY([batterySwapId]) REFERENCES [battery_swaps]([id]) ON DELETE NO ACTION,
          CONSTRAINT [CK_battery_reservations_status] CHECK([status] IN ('RESERVED','REDEEMED','CANCELLED','EXPIRED'))
        )
      `);
    }
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_reservations_station_status_expiry') CREATE INDEX [IDX_battery_reservations_station_status_expiry] ON [battery_reservations]([stationId],[status],[expiresAt])");
    await queryRunner.query("IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IDX_battery_reservations_customer_status_expiry') CREATE INDEX [IDX_battery_reservations_customer_status_expiry] ON [battery_reservations]([customerId],[status],[expiresAt])");
  }
  async down(queryRunner:QueryRunner):Promise<void>{
    if(await queryRunner.hasTable('battery_reservations')) await queryRunner.dropTable('battery_reservations');
  }
}
