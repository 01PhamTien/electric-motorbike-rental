-- Run once against the electric_motorbike_rental database before deploying the maintenance scheduling release.
-- Nullable for backward compatibility with existing maintenance records.
ALTER TABLE maintenance_records
  ADD COLUMN plannedEndAt DATETIME NULL AFTER scheduledAt;
