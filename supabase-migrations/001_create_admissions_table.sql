-- Create admissions table
CREATE TABLE IF NOT EXISTS admissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  last_name VARCHAR(255) NOT NULL,
  dob DATE NOT NULL,
  age INTEGER NOT NULL,
  sex VARCHAR(1),
  date_of_admission DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on date_of_admission for faster queries
CREATE INDEX idx_admissions_date ON admissions(date_of_admission);

-- Create index on last_name for search
CREATE INDEX idx_admissions_last_name ON admissions(last_name);

-- Enable Row Level Security
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for demo purposes)
CREATE POLICY "Allow public insert" ON admissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to read (for demo purposes)
CREATE POLICY "Allow public read" ON admissions
  FOR SELECT TO anon, authenticated
  USING (true);

