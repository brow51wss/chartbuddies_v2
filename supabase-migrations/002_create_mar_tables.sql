-- Create MAR header table (links to admission and patient info)
CREATE TABLE IF NOT EXISTS mar_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admission_id UUID REFERENCES admissions(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- Format: "MM/YYYY"
  facility_name VARCHAR(255),
  patient_name VARCHAR(255),
  date_of_birth DATE,
  sex VARCHAR(1),
  allergies TEXT,
  diagnosis TEXT,
  diet_instructions TEXT,
  physician_name VARCHAR(255),
  physician_phone VARCHAR(20),
  record_number VARCHAR(50),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create medications table (one row per medication)
CREATE TABLE IF NOT EXISTS mar_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_record_id UUID REFERENCES mar_records(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  stop_date DATE,
  hour TIME, -- Time of administration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create medication administration records (one per dose given)
CREATE TABLE IF NOT EXISTS mar_administration (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID REFERENCES mar_medications(id) ON DELETE CASCADE,
  mar_record_id UUID REFERENCES mar_records(id) ON DELETE CASCADE,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  initials VARCHAR(10),
  given BOOLEAN DEFAULT true,
  reason_for_omission TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(medication_id, day_of_month) -- One entry per medication per day
);

-- Create vital signs table
CREATE TABLE IF NOT EXISTS mar_vital_signs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_record_id UUID REFERENCES mar_records(id) ON DELETE CASCADE,
  vital_type VARCHAR(20) NOT NULL, -- 'TEMPERATURE', 'PULSE', 'RESPIRATION', 'WEIGHT'
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  value VARCHAR(50), -- Store as string for flexibility (could be "98.6", "72 bpm", etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mar_record_id, vital_type, day_of_month) -- One entry per vital sign type per day
);

-- Create PRN and medications not administered table
CREATE TABLE IF NOT EXISTS mar_prn_not_administered (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_record_id UUID REFERENCES mar_records(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour TIME,
  initials VARCHAR(10),
  medication VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  result TEXT,
  staff_signature VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_mar_records_admission ON mar_records(admission_id);
CREATE INDEX idx_mar_records_month_year ON mar_records(month_year);
CREATE INDEX idx_mar_medications_record ON mar_medications(mar_record_id);
CREATE INDEX idx_mar_administration_record ON mar_administration(mar_record_id);
CREATE INDEX idx_mar_administration_day ON mar_administration(day_of_month);
CREATE INDEX idx_mar_vital_signs_record ON mar_vital_signs(mar_record_id);
CREATE INDEX idx_mar_vital_signs_day ON mar_vital_signs(day_of_month);
CREATE INDEX idx_mar_prn_record ON mar_prn_not_administered(mar_record_id);

-- Enable Row Level Security
ALTER TABLE mar_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_administration ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_prn_not_administered ENABLE ROW LEVEL SECURITY;

-- Allow public access for demo (all tables)
CREATE POLICY "Allow public access mar_records" ON mar_records
  FOR ALL TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public access mar_medications" ON mar_medications
  FOR ALL TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public access mar_administration" ON mar_administration
  FOR ALL TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public access mar_vital_signs" ON mar_vital_signs
  FOR ALL TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public access mar_prn_not_administered" ON mar_prn_not_administered
  FOR ALL TO anon, authenticated
  USING (true);

