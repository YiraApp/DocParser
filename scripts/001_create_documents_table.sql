-- Create documents table to store parsed document data
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  document_type TEXT,
  parsed_fields JSONB,
  summary TEXT,
  notes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user searches
CREATE INDEX IF NOT EXISTS idx_documents_user_name ON public.documents(user_name);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we don't have auth)
-- In production, you'd want to add proper authentication
CREATE POLICY "Allow public read access" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.documents
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.documents
  FOR DELETE USING (true);
