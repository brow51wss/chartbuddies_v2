-- Allow PRN staff_signature to store drawn signatures (PNG data URLs), same as user profile
ALTER TABLE mar_prn_records
  ALTER COLUMN staff_signature TYPE TEXT;
