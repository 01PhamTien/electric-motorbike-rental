import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaintenanceSchedules1794096000000 implements MigrationInterface {
  name = 'AddMaintenanceSchedules1794096000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('maintenance_schedules')) return;
    await queryRunner.query(`CREATE TABLE [maintenance_schedules] (
      [id] int IDENTITY(1,1) NOT NULL,
      [vehicleId] int NOT NULL,
      [intervalKm] int NOT NULL,
      [intervalDays] int NOT NULL,
      [warningKm] int NOT NULL CONSTRAINT [DF_maintenance_schedules_warningKm] DEFAULT 500,
      [warningDays] int NOT NULL CONSTRAINT [DF_maintenance_schedules_warningDays] DEFAULT 7,
      [lastServiceOdometerKm] decimal(12,1) NOT NULL CONSTRAINT [DF_maintenance_schedules_lastOdo] DEFAULT 0,
      [lastServiceAt] datetime2 NOT NULL,
      [isActive] bit NOT NULL CONSTRAINT [DF_maintenance_schedules_active] DEFAULT 1,
      [updatedById] int NOT NULL,
      [createdAt] datetime2 NOT NULL CONSTRAINT [DF_maintenance_schedules_created] DEFAULT SYSUTCDATETIME(),
      [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_maintenance_schedules_updated] DEFAULT SYSUTCDATETIME(),
      CONSTRAINT [PK_maintenance_schedules] PRIMARY KEY ([id]),
      CONSTRAINT [FK_maintenance_schedules_vehicle] FOREIGN KEY ([vehicleId]) REFERENCES [vehicles]([id]) ON DELETE NO ACTION,
      CONSTRAINT [FK_maintenance_schedules_user] FOREIGN KEY ([updatedById]) REFERENCES [users]([id]) ON DELETE NO ACTION,
      CONSTRAINT [UQ_maintenance_schedules_vehicle] UNIQUE ([vehicleId]),
      CONSTRAINT [CK_maintenance_schedules_intervalKm] CHECK ([intervalKm] BETWEEN 100 AND 50000),
      CONSTRAINT [CK_maintenance_schedules_intervalDays] CHECK ([intervalDays] BETWEEN 1 AND 730)
    )`);
    await queryRunner.query('CREATE INDEX [IDX_maintenance_schedules_active] ON [maintenance_schedules] ([isActive], [vehicleId])');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('maintenance_schedules')) await queryRunner.query('DROP TABLE [maintenance_schedules]');
  }
}
