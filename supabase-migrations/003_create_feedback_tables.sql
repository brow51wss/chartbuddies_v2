-- Create feedback notes table
CREATE TABLE IF NOT EXISTS feedback_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url VARCHAR(500) NOT NULL,
  component_path TEXT, -- CSS selector or component identifier
  x_position INTEGER, -- X coordinate on page
  y_position INTEGER, -- Y coordinate on page
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'incomplete' CHECK (status IN ('complete', 'incomplete')),
  tester_name VARCHAR(255),
  tab_name VARCHAR(50), -- For tabbed pages like MAR (medications/vitals/prn)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback images table (for multiple images per note)
CREATE TABLE IF NOT EXISTS feedback_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_note_id UUID REFERENCES feedback_notes(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL, -- Will store Supabase storage URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_feedback_notes_page_url ON feedback_notes(page_url);
CREATE INDEX idx_feedback_notes_status ON feedback_notes(status);
CREATE INDEX idx_feedback_notes_created ON feedback_notes(created_at);
CREATE INDEX idx_feedback_images_note ON feedback_images(feedback_note_id);

-- Enable Row Level Security
ALTER TABLE feedback_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_images ENABLE ROW LEVEL SECURITY;

-- Allow public access for demo (all tables)
CREATE POLICY "Allow public access feedback_notes" ON feedback_notes
  FOR ALL TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public access feedback_images" ON feedback_images
  FOR ALL TO anon, authenticated
  USING (true);

