-- Add health recommendations column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS health_recommendations JSONB DEFAULT NULL;

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_documents_health_recommendations 
ON documents USING GIN (health_recommendations);

-- Add comment
COMMENT ON COLUMN documents.health_recommendations IS 'AI-generated health recommendations based on parsed medical data';
