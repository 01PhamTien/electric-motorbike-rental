import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Immutable initial schema generated from the 2026-11-03 entities on MySQL 8.4.
 * Intended for a new, empty database only. See docs/DATABASE-MIGRATIONS.md
 * for adopting an existing synchronize-created schema safely.
 */
export class InitialRentalSchema1793664000000 implements MigrationInterface {
  name = 'InitialRentalSchema1793664000000';
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name NOT IN ('migrations')",
    );
    if (Number(existing[0]?.total || 0) > 0) {
      throw new Error('Initial migration requires an empty database. Back up and baseline existing schemas separately.');
    }
    await queryRunner.query("CREATE TABLE `users` (`id` int NOT NULL AUTO_INCREMENT, `fullName` varchar(120) NOT NULL, `email` varchar(160) NOT NULL, `phone` varchar(20) NULL, `passwordHash` varchar(255) NOT NULL, `role` enum ('CUSTOMER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER', `status` enum ('ACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE', `stationId` int NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_97672ac88f789774dd47f7c8be` (`email`), UNIQUE INDEX `IDX_a000cca60bcf04454e72769949` (`phone`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `stations` (`id` int NOT NULL AUTO_INCREMENT, `name` varchar(120) NOT NULL, `address` varchar(255) NOT NULL, `latitude` decimal(10,7) NOT NULL, `longitude` decimal(10,7) NOT NULL, `phone` varchar(30) NULL, `isActive` tinyint NOT NULL DEFAULT 1, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `vehicle_models` (`id` int NOT NULL AUTO_INCREMENT, `brand` varchar(100) NOT NULL, `name` varchar(120) NOT NULL, `specifications` text NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `bookings` (`id` int NOT NULL AUTO_INCREMENT, `customerId` int NOT NULL, `vehicleId` int NOT NULL, `pickupAt` datetime NOT NULL, `returnAt` datetime NOT NULL, `dailyRateSnapshot` decimal(12,2) NOT NULL, `depositSnapshot` decimal(12,2) NOT NULL, `rentalAmount` decimal(12,2) NOT NULL, `holdExpiresAt` datetime NULL, `status` enum ('PENDING', 'CONFIRMED', 'RENTING', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING', `cancelReason` varchar(255) NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_bae2b90c90f6a97e999746c9b8` (`vehicleId`, `pickupAt`, `returnAt`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `vehicle_locations` (`id` int NOT NULL AUTO_INCREMENT, `vehicleId` int NOT NULL, `latitude` decimal(10,7) NOT NULL, `longitude` decimal(10,7) NOT NULL, `source` varchar(30) NOT NULL DEFAULT 'MANUAL_SIMULATION', `updatedById` int NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `IDX_7b4feecd71ccc99391ac541407` (`vehicleId`, `createdAt`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `vehicles` (`id` int NOT NULL AUTO_INCREMENT, `code` varchar(50) NOT NULL, `licensePlate` varchar(30) NOT NULL, `modelId` int NOT NULL, `stationId` int NOT NULL, `dailyRate` decimal(12,2) NOT NULL, `depositAmount` decimal(12,2) NOT NULL DEFAULT '0.00', `status` enum ('ACTIVE', 'CHARGING', 'MAINTENANCE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', `isActive` tinyint NOT NULL DEFAULT 1, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_6018477317389aba7db348042e` (`code`), UNIQUE INDEX `IDX_79a273823977d25c7523162cd5` (`licensePlate`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `payment_transactions` (`id` int NOT NULL AUTO_INCREMENT, `bookingId` int NOT NULL, `purpose` enum ('RENT', 'DEPOSIT', 'EXTRA', 'REFUND') NOT NULL, `method` enum ('CASH', 'TRANSFER') NOT NULL, `amount` decimal(12,2) NOT NULL, `note` varchar(255) NULL, `idempotencyKey` varchar(100) NOT NULL, `recordedById` int NOT NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `IDX_d3621540be4bed2af911910697` (`bookingId`), UNIQUE INDEX `IDX_876b0f8f2d5b307f5b736c1814` (`idempotencyKey`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `maintenance_records` (`id` int NOT NULL AUTO_INCREMENT, `vehicleId` int NOT NULL, `scheduledAt` datetime NOT NULL, `completedAt` datetime NULL, `reason` varchar(160) NOT NULL, `description` text NULL, `cost` decimal(12,2) NOT NULL DEFAULT '0.00', `status` enum ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED', `createdById` int NOT NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_a771c93619c49d95a963eeab5b` (`vehicleId`, `scheduledAt`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `handover_records` (`id` int NOT NULL AUTO_INCREMENT, `bookingId` int NOT NULL, `kind` enum ('PICKUP', 'RETURN') NOT NULL, `batteryPercent` int NOT NULL, `odometerKm` decimal(12,1) NOT NULL, `conditionNote` varchar(1000) NOT NULL, `staffId` int NOT NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_c9abfe259a9874a81bb6b92c81` (`bookingId`, `kind`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("CREATE TABLE `booking_status_histories` (`id` int NOT NULL AUTO_INCREMENT, `bookingId` int NOT NULL, `fromStatus` enum ('PENDING', 'CONFIRMED', 'RENTING', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL, `toStatus` enum ('PENDING', 'CONFIRMED', 'RENTING', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL, `performedById` int NULL, `reason` varchar(255) NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await queryRunner.query("ALTER TABLE `users` ADD CONSTRAINT `FK_94754bc4f5522eee5c245371906` FOREIGN KEY (`stationId`) REFERENCES `stations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `bookings` ADD CONSTRAINT `FK_67b9cd20f987fc6dc70f7cd283f` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `bookings` ADD CONSTRAINT `FK_30909e71d6dd969e95d995258f1` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `vehicle_locations` ADD CONSTRAINT `FK_7f0bde5c132ae27f57f34c35d46` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `vehicle_locations` ADD CONSTRAINT `FK_bbbc7b224482777cb987108e78f` FOREIGN KEY (`updatedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `vehicles` ADD CONSTRAINT `FK_5fe3e38b9bf4649e65fdfb04bdf` FOREIGN KEY (`modelId`) REFERENCES `vehicle_models`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `vehicles` ADD CONSTRAINT `FK_203683541105ef9807708f0622d` FOREIGN KEY (`stationId`) REFERENCES `stations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `payment_transactions` ADD CONSTRAINT `FK_d3621540be4bed2af9119106971` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `handover_records` ADD CONSTRAINT `FK_a16ec680355bca9984e110e4e62` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `handover_records` ADD CONSTRAINT `FK_61b43a3a5dca0dc3e318b715652` FOREIGN KEY (`staffId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `booking_status_histories` ADD CONSTRAINT `FK_155c38b6ca77812ee21996415d5` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE `booking_status_histories` ADD CONSTRAINT `FK_d2686169cdb07deb95c6bdbf163` FOREIGN KEY (`performedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION");
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Initial schema is not automatically reversible. Restore a database backup instead.');
  }
}
