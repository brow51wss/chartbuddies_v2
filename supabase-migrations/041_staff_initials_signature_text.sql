-- Allow staff_initials and staff_signature to store drawn signatures (PNG data URLs)
-- Data URLs can be very long; VARCHAR(10)/VARCHAR(255) are too small
ALTER TABLE user_profiles
  ALTER COLUMN staff_initials TYPE TEXT,
  ALTER COLUMN staff_signature TYPE TEXT;
