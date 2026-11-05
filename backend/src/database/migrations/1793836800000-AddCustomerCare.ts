import { MigrationInterface, QueryRunner } from 'typeorm';

/** Verified vehicle reviews and customer support issues linked to an active rental. */
export class AddCustomerCare1793836800000 implements MigrationInterface {
  name = 'AddCustomerCare1793836800000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TABLE vehicle_reviews (id int NOT NULL AUTO_INCREMENT, bookingId int NOT NULL, vehicleId int NOT NULL, customerId int NOT NULL, rating int NOT NULL, comment varchar(1200) NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX UQ_vehicle_reviews_booking (bookingId), INDEX IDX_vehicle_reviews_vehicle_created (vehicleId, createdAt), CONSTRAINT CK_vehicle_reviews_rating CHECK (rating >= 1 AND rating <= 5), PRIMARY KEY (id)) ENGINE=InnoDB");
    await queryRunner.query("ALTER TABLE vehicle_reviews ADD CONSTRAINT FK_vehicle_reviews_booking FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE vehicle_reviews ADD CONSTRAINT FK_vehicle_reviews_vehicle FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE RESTRICT ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE vehicle_reviews ADD CONSTRAINT FK_vehicle_reviews_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION");

    await queryRunner.query("CREATE TABLE booking_issues (id int NOT NULL AUTO_INCREMENT, bookingId int NOT NULL, vehicleId int NOT NULL, customerId int NOT NULL, issueType varchar(30) NOT NULL, severity varchar(20) NOT NULL, status varchar(20) NOT NULL DEFAULT 'OPEN', description varchar(2000) NOT NULL, latitude decimal(10,7) NULL, longitude decimal(10,7) NULL, resolutionNote varchar(1000) NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX IDX_booking_issues_booking_created (bookingId, createdAt), INDEX IDX_booking_issues_status_created (status, createdAt), CONSTRAINT CK_booking_issues_type CHECK (issueType IN ('BREAKDOWN','LOW_BATTERY','ACCIDENT','OTHER')), CONSTRAINT CK_booking_issues_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')), CONSTRAINT CK_booking_issues_status CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CANCELLED')), PRIMARY KEY (id)) ENGINE=InnoDB");
    await queryRunner.query("ALTER TABLE booking_issues ADD CONSTRAINT FK_booking_issues_booking FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE RESTRICT ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE booking_issues ADD CONSTRAINT FK_booking_issues_vehicle FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE RESTRICT ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE booking_issues ADD CONSTRAINT FK_booking_issues_customer FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION");
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE booking_issues');
    await queryRunner.query('DROP TABLE vehicle_reviews');
  }
}
