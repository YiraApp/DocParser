-- Add file_url column to store Supabase Storage URLs
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN documents.file_url IS 'Public URL to the original file stored in Supabase Storage';
