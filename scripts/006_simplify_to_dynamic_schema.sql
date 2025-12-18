-- Drop all the rigid field-specific columns and keep only essential metadata
-- All extracted data will be stored in the structured_data JSONB column for maximum flexibility

ALTER TABLE documents 
DROP COLUMN IF EXISTS hospital,
DROP COLUMN IF EXISTS date_of_birth,
DROP COLUMN IF EXISTS gender,
DROP COLUMN IF EXISTS medications,
DROP COLUMN IF EXISTS diagnosis,
DROP COLUMN IF EXISTS summary,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS doctor,
DROP COLUMN IF EXISTS report_date,
DROP COLUMN IF EXISTS procedures,
DROP COLUMN IF EXISTS lab_results,
DROP COLUMN IF EXISTS vital_signs,
DROP COLUMN IF EXISTS allergies,
DROP COLUMN IF EXISTS dietary_advice,
DROP COLUMN IF EXISTS follow_up_instructions,
DROP COLUMN IF EXISTS contact_numbers,
DROP COLUMN IF EXISTS admission_date,
DROP COLUMN IF EXISTS discharge_date,
DROP COLUMN IF EXISTS age,
DROP COLUMN IF EXISTS mr_number,
DROP COLUMN IF EXISTS ip_number;

-- Ensure we have the structured_data column for storing all extracted data
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Add a GIN index on structured_data for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_documents_structured_data ON documents USING GIN (structured_data);

-- Add a text search column for full-text search across all extracted data
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS search_text TEXT GENERATED ALWAYS AS (
  COALESCE(user_name, '') || ' ' ||
  COALESCE(document_type, '') || ' ' ||
  COALESCE(file_name, '') || ' ' ||
  COALESCE(structured_data::text, '')
) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_text ON documents USING GIN (to_tsvector('english', search_text));
