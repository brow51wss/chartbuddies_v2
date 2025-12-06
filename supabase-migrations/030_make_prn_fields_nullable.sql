-- Make PRN record fields nullable so they can be edited in table view
-- Time, Initials, and Staff Signature should be editable after creation

ALTER TABLE mar_prn_records 
  ALTER COLUMN hour DROP NOT NULL,
  ALTER COLUMN initials DROP NOT NULL,
  ALTER COLUMN staff_signature DROP NOT NULL;

