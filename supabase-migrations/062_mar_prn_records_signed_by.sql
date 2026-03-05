-- Track who signed each PRN record so we can show current profile signature for that user.
ALTER TABLE mar_prn_records
  ADD COLUMN IF NOT EXISTS signed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mar_prn_records_signed_by ON mar_prn_records(signed_by);

COMMENT ON COLUMN mar_prn_records.signed_by IS 'User who signed this PRN record; used to display current profile signature when viewing.';
