-- Create storage bucket for medical documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-documents', 'medical-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies to allow public access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'medical-documents' );

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'medical-documents' );

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'medical-documents' );

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'medical-documents' );
