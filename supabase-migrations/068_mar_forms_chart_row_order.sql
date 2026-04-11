-- Persist combined MAR chart row order (medication groups + PRN chart rows) for interleaved drag-and-drop.

ALTER TABLE mar_forms
  ADD COLUMN IF NOT EXISTS mar_chart_row_order JSONB DEFAULT NULL;

COMMENT ON COLUMN mar_forms.mar_chart_row_order IS
  'Ordered chart rows: [{type:"med",firstMedId:"uuid"},{type:"prn",prnGroupKey:"med|dosage|reason|startDate"},...]. Legacy entries may use prnId (single record id) — clients map to prnGroupKey. Null = derive order from medications then PRN groups.';
