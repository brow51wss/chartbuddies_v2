-- Store the font chosen for signature/initials so the MAR can render the text version in that font
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS staff_signature_font VARCHAR(100);
