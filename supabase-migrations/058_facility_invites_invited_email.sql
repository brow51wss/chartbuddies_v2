-- Record who was invited and when (for send-from-EHR flow and PCG view)
ALTER TABLE facility_invites
ADD COLUMN IF NOT EXISTS invited_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN facility_invites.invited_email IS 'Email address the invite was sent to (when sent from EHR)';
COMMENT ON COLUMN facility_invites.invited_at IS 'When the invite was sent to invited_email';
