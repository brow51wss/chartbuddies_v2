-- Update all existing "MC" (Medication Discontinued) records to "DC" (Discontinued)
-- This migration updates the legend code from MC to DC for consistency

UPDATE mar_administrations
SET initials = 'DC'
WHERE initials = 'MC';

