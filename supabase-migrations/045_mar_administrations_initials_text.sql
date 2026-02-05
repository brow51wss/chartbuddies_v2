-- Allow mar_administrations.initials to store image data URLs (same as profile signature/initials)
ALTER TABLE mar_administrations
  ALTER COLUMN initials TYPE TEXT;
