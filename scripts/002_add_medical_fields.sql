-- Add medical-specific fields to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS hospital TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS medications TEXT[];

-- Create indexes for faster queries on new fields
CREATE INDEX IF NOT EXISTS idx_documents_hospital ON public.documents(hospital);
CREATE INDEX IF NOT EXISTS idx_documents_gender ON public.documents(gender);
CREATE INDEX IF NOT EXISTS idx_documents_date_of_birth ON public.documents(date_of_birth);
