-- Run once against electric_motorbike_rental before deploying profile avatar support.
ALTER TABLE users
  ADD COLUMN avatarUrl VARCHAR(2048) NULL AFTER phone;
