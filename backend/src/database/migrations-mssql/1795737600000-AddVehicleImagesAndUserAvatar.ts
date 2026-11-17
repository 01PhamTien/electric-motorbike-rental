import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleImagesAndUserAvatar1795737600000 implements MigrationInterface {
  name = 'AddVehicleImagesAndUserAvatar1795737600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) throw new Error('Cannot add profile avatar: users table does not exist.');
    if (!(await queryRunner.hasTable('vehicles'))) throw new Error('Cannot add vehicle gallery: vehicles table does not exist.');

    await queryRunner.query(`
      IF COL_LENGTH(N'dbo.users', N'avatarUrl') IS NULL
        ALTER TABLE [dbo].[users] ADD [avatarUrl] nvarchar(2048) NULL;
      IF OBJECT_ID(N'dbo.vehicle_images', N'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[vehicle_images] (
          [id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_vehicle_images] PRIMARY KEY,
          [vehicleId] int NOT NULL,
          [imageUrl] nvarchar(2048) NOT NULL,
          [createdAt] datetime2 NOT NULL CONSTRAINT [DF_vehicle_images_createdAt] DEFAULT getdate(),
          CONSTRAINT [FK_vehicle_images_vehicle] FOREIGN KEY ([vehicleId])
            REFERENCES [dbo].[vehicles]([id]) ON DELETE CASCADE
        );
        CREATE INDEX [IDX_vehicle_images_vehicleId] ON [dbo].[vehicle_images] ([vehicleId]);
      END
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('vehicle_images')) {
      const count = await queryRunner.query('SELECT COUNT(*) AS [total] FROM [dbo].[vehicle_images]');
      if (Number(count[0]?.total ?? 0) > 0) throw new Error('Cannot drop vehicle images containing uploaded image references.');
      await queryRunner.query('DROP TABLE [dbo].[vehicle_images]');
    }
    if (await queryRunner.hasColumn('users', 'avatarUrl')) {
      const count = await queryRunner.query('SELECT COUNT(*) AS [total] FROM [dbo].[users] WHERE [avatarUrl] IS NOT NULL');
      if (Number(count[0]?.total ?? 0) > 0) throw new Error('Cannot drop avatar URLs while profile images are in use.');
      await queryRunner.query('ALTER TABLE [dbo].[users] DROP COLUMN [avatarUrl]');
    }
  }
}
