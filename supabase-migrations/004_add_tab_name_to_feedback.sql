-- Add tab_name column to feedback_notes table for tabbed pages
ALTER TABLE feedback_notes 
ADD COLUMN IF NOT EXISTS tab_name VARCHAR(50);

-- Add index for filtering by tab
CREATE INDEX IF NOT EXISTS idx_feedback_notes_tab_name ON feedback_notes(tab_name);

