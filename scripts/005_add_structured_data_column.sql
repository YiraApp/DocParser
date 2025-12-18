-- Add structured_data column to store complete JSON
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_structured_data ON documents USING GIN (structured_data);

-- Add comment
COMMENT ON COLUMN documents.structured_data IS 'Complete structured JSON data extracted from the document';
