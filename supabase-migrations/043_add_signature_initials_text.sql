-- Store the typed text for signature and initials so the text field can show it when loading the profile
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS staff_signature_text TEXT,
  ADD COLUMN IF NOT EXISTS staff_initials_text TEXT;
