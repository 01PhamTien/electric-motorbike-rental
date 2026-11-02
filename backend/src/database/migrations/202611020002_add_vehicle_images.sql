-- Run once against the electric_motorbike_rental database before deploying vehicle gallery support.
-- Image files are hosted externally; this table stores their HTTP(S) URLs.
CREATE TABLE vehicle_images (
  id INT NOT NULL AUTO_INCREMENT,
  vehicleId INT NOT NULL,
  imageUrl VARCHAR(2048) NOT NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX IDX_vehicle_images_vehicleId (vehicleId),
  CONSTRAINT FK_vehicle_images_vehicle
    FOREIGN KEY (vehicleId) REFERENCES vehicles(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
