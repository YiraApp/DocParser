-- Add doctor and report_date columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS doctor TEXT,
ADD COLUMN IF NOT EXISTS report_date DATE;

-- Add index for faster queries on report_date
CREATE INDEX IF NOT EXISTS idx_documents_report_date ON documents(report_date);

-- Add index for doctor searches
CREATE INDEX IF NOT EXISTS idx_documents_doctor ON documents(doctor);
