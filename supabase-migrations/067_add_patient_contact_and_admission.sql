-- Patient registration / admissions: contact + admission date (optional columns; existing rows stay null)

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS home_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admission_date DATE;

COMMENT ON COLUMN patients.street_address IS 'Patient street address from admissions registration.';
COMMENT ON COLUMN patients.city IS 'Patient city from admissions registration.';
COMMENT ON COLUMN patients.state IS 'Patient state from admissions registration.';
COMMENT ON COLUMN patients.zip_code IS 'Patient ZIP/postal code from admissions registration.';
COMMENT ON COLUMN patients.home_phone IS 'Patient home phone from admissions registration.';
COMMENT ON COLUMN patients.email IS 'Patient email from admissions registration.';
COMMENT ON COLUMN patients.admission_date IS 'Facility admission date captured at registration.';
