-- Complete Database Schema for Hospital Management System
-- Run this migration after 001_create_admissions_table.sql

-- ============================================
-- 1. HOSPITALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  facility_type VARCHAR(100) NOT NULL DEFAULT 'hospital', -- 'hospital', 'home_care', etc.
  invite_code VARCHAR(20) UNIQUE NOT NULL, -- Unique code for nurses to join
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hospitals_invite_code ON hospitals(invite_code);
CREATE INDEX idx_hospitals_is_active ON hospitals(is_active);

-- ============================================
-- 2. USER PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'superadmin', 'head_nurse', 'nurse'
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  staff_initials VARCHAR(10), -- For MAR forms (e.g., "JS")
  staff_signature VARCHAR(255), -- Full signature
  designation VARCHAR(50), -- 'RN', 'LPN', 'CNA', etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_role CHECK (role IN ('superadmin', 'head_nurse', 'nurse'))
);

CREATE INDEX idx_user_profiles_hospital_id ON user_profiles(hospital_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ============================================
-- 3. PATIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  record_number VARCHAR(100) UNIQUE NOT NULL,
  date_of_birth DATE NOT NULL,
  sex VARCHAR(10) NOT NULL CHECK (sex IN ('Male', 'Female', 'Other')),
  diagnosis TEXT,
  diet TEXT,
  allergies TEXT NOT NULL DEFAULT '',
  physician_name VARCHAR(255) NOT NULL,
  physician_phone VARCHAR(20),
  facility_name VARCHAR(255),
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patients_hospital_id ON patients(hospital_id);
CREATE INDEX idx_patients_record_number ON patients(record_number);
CREATE INDEX idx_patients_created_by ON patients(created_by);

-- ============================================
-- 4. NURSE-PATIENT ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS nurse_patient_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES user_profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(nurse_id, patient_id)
);

CREATE INDEX idx_assignments_nurse_id ON nurse_patient_assignments(nurse_id);
CREATE INDEX idx_assignments_patient_id ON nurse_patient_assignments(patient_id);

-- ============================================
-- 5. MAR FORMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mar_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  month_year VARCHAR(20) NOT NULL, -- Format: "November 2025"
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'archived'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Patient info (can be different from patient record at time of creation)
  patient_name VARCHAR(255) NOT NULL,
  record_number VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  sex VARCHAR(10) NOT NULL,
  diagnosis TEXT,
  diet TEXT,
  allergies TEXT NOT NULL DEFAULT '',
  physician_name VARCHAR(255) NOT NULL,
  physician_phone VARCHAR(20),
  facility_name VARCHAR(255)
);

CREATE INDEX idx_mar_forms_patient_id ON mar_forms(patient_id);
CREATE INDEX idx_mar_forms_hospital_id ON mar_forms(hospital_id);
CREATE INDEX idx_mar_forms_month_year ON mar_forms(month_year);
CREATE INDEX idx_mar_forms_status ON mar_forms(status);

-- ============================================
-- 6. MAR MEDICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mar_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_form_id UUID NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  dosage TEXT NOT NULL, -- e.g., "10 mg PO daily"
  start_date DATE NOT NULL,
  stop_date DATE,
  hour TIME NOT NULL, -- Scheduled administration time
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mar_medications_mar_form_id ON mar_medications(mar_form_id);

-- ============================================
-- 7. MAR ADMINISTRATION RECORDS (Daily entries)
-- ============================================
CREATE TABLE IF NOT EXISTS mar_administrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_medication_id UUID NOT NULL REFERENCES mar_medications(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 31),
  status VARCHAR(50) NOT NULL DEFAULT 'Not Given', -- 'Given', 'Not Given', 'PRN'
  initials VARCHAR(10), -- Staff initials who administered
  notes TEXT,
  administered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mar_medication_id, day_number)
);

CREATE INDEX idx_mar_admin_medication_id ON mar_administrations(mar_medication_id);
CREATE INDEX idx_mar_admin_day_number ON mar_administrations(day_number);

-- ============================================
-- 8. PRN AND NOT ADMINISTERED RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS mar_prn_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_form_id UUID NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour TIME NOT NULL,
  initials VARCHAR(10) NOT NULL,
  medication VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  result TEXT,
  staff_signature VARCHAR(255) NOT NULL,
  entry_number INTEGER, -- Sequential number (1-19)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mar_prn_mar_form_id ON mar_prn_records(mar_form_id);
CREATE INDEX idx_mar_prn_date ON mar_prn_records(date);

-- ============================================
-- 9. VITAL SIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mar_vital_signs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_form_id UUID NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 31),
  temperature DECIMAL(5,2), -- e.g., 98.6
  pulse INTEGER,
  respiration INTEGER,
  weight DECIMAL(6,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mar_form_id, day_number)
);

CREATE INDEX idx_vital_signs_mar_form_id ON mar_vital_signs(mar_form_id);
CREATE INDEX idx_vital_signs_day_number ON mar_vital_signs(day_number);

-- ============================================
-- 10. AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'view'
  entity_type VARCHAR(100) NOT NULL, -- 'patient', 'mar_form', 'medication', etc.
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_hospital_id ON audit_logs(hospital_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurse_patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_administrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_prn_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mar_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- HOSPITALS: Superadmins can see all, others see only their hospital
CREATE POLICY "Superadmins see all hospitals" ON hospitals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Users see own hospital" ON hospitals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = hospitals.id
    )
  );

-- USER_PROFILES: Users can see profiles in their hospital
CREATE POLICY "Users see profiles in their hospital" ON user_profiles
  FOR SELECT
  USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = user_profiles.hospital_id)
      )
    )
  );

-- PATIENTS: Users can see patients in their hospital, nurses only assigned patients
CREATE POLICY "Superadmins see all patients" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Head nurses see hospital patients" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = patients.hospital_id
      AND user_profiles.role IN ('superadmin', 'head_nurse')
    )
  );

CREATE POLICY "Nurses see assigned patients" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nurse_patient_assignments npa
      JOIN user_profiles up ON up.id = npa.nurse_id
      WHERE up.id = auth.uid()
      AND npa.patient_id = patients.id
      AND npa.is_active = true
    )
  );

-- MAR_FORMS: Similar access as patients
CREATE POLICY "Users see relevant MAR forms" ON mar_forms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = mar_forms.hospital_id AND up.role = 'head_nurse') OR
        EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = mar_forms.patient_id
          AND npa.is_active = true
        )
      )
    )
  );

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Head nurses and superadmins can insert/update patients
CREATE POLICY "Head nurses can manage patients" ON patients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = patients.hospital_id
      AND user_profiles.role IN ('superadmin', 'head_nurse')
    )
  );

-- Nurses can insert patients if assigned
CREATE POLICY "Nurses can insert patients" ON patients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = patients.hospital_id
      AND user_profiles.role = 'nurse'
    )
  );

-- Nurses can update assigned patients
CREATE POLICY "Nurses can update assigned patients" ON patients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nurse_patient_assignments npa
      JOIN user_profiles up ON up.id = npa.nurse_id
      WHERE up.id = auth.uid()
      AND npa.patient_id = patients.id
      AND npa.is_active = true
    )
  );

-- Allow nurses to insert/update MAR forms for assigned patients
CREATE POLICY "Users can manage MAR forms for accessible patients" ON mar_forms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = mar_forms.hospital_id AND up.role = 'head_nurse') OR
        EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = mar_forms.patient_id
          AND npa.is_active = true
        )
      )
    )
  );

-- Allow access to related MAR tables if user has access to parent MAR form
CREATE POLICY "Users can manage MAR medications" ON mar_medications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_medications.mar_form_id
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = mf.hospital_id AND up.role = 'head_nurse') OR
        EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = mf.patient_id
          AND npa.is_active = true
        )
      )
    )
  );

CREATE POLICY "Users can manage MAR administrations" ON mar_administrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_medications mm
      JOIN mar_forms mf ON mf.id = mm.mar_form_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mm.id = mar_administrations.mar_medication_id
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = mf.hospital_id AND up.role = 'head_nurse') OR
        EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = mf.patient_id
          AND npa.is_active = true
        )
      )
    )
  );

CREATE POLICY "Users can manage MAR PRN records" ON mar_prn_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_prn_records.mar_form_id
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = mf.hospital_id AND up.role = 'head_nurse') OR
        EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = mf.patient_id
          AND npa.is_active = true
        )
      )
    )
  );

CREATE POLICY "Users can manage vital signs" ON mar_vital_signs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_vital_signs.mar_form_id
      AND (
        up.role = 'superadmin' OR
        (up.hospital_id = mf.hospital_id AND up.role = 'head_nurse') OR
        EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = mf.patient_id
          AND npa.is_active = true
        )
      )
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mar_forms_updated_at BEFORE UPDATE ON mar_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mar_medications_updated_at BEFORE UPDATE ON mar_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mar_administrations_updated_at BEFORE UPDATE ON mar_administrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mar_prn_records_updated_at BEFORE UPDATE ON mar_prn_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mar_vital_signs_updated_at BEFORE UPDATE ON mar_vital_signs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes confusing chars
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile after auth signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role, hospital_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'nurse', -- Default role, can be updated
    NULL -- Will be set when hospital is created or joined
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

