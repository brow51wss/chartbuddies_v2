-- Create table for user-specific custom MAR legends
CREATE TABLE IF NOT EXISTS mar_custom_legends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL, -- The legend code (e.g., "ABC")
  description TEXT NOT NULL, -- The description (e.g., "Absent from Care")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, code) -- Each user can only have one legend per code
);

CREATE INDEX idx_mar_custom_legends_user_id ON mar_custom_legends(user_id);

-- Enable RLS
ALTER TABLE mar_custom_legends ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own custom legends
CREATE POLICY "Users can view own custom legends" ON mar_custom_legends
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own custom legends
CREATE POLICY "Users can insert own custom legends" ON mar_custom_legends
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own custom legends
CREATE POLICY "Users can update own custom legends" ON mar_custom_legends
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own custom legends
CREATE POLICY "Users can delete own custom legends" ON mar_custom_legends
  FOR DELETE
  USING (auth.uid() = user_id);

