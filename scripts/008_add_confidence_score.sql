-- Add confidence_score column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN documents.confidence_score IS 'Parsing confidence score (0-100) indicating reliability of extracted data';
