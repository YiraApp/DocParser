-- Drop existing table if it exists (for clean setup)
DROP TABLE IF EXISTS public.documents CASCADE;

-- Create documents table with all fields including medical data
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  document_type TEXT,
  parsed_fields JSONB,
  summary TEXT,
  notes JSONB,
  hospital TEXT,
  date_of_birth DATE,
  gender TEXT,
  medications TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster searches
CREATE INDEX idx_documents_user_name ON public.documents(user_name);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX idx_documents_hospital ON public.documents(hospital);
CREATE INDEX idx_documents_gender ON public.documents(gender);
CREATE INDEX idx_documents_date_of_birth ON public.documents(date_of_birth);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.documents
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.documents
  FOR DELETE USING (true);

-- Insert test medical records data
INSERT INTO public.documents (
  user_name,
  file_name,
  file_size,
  document_type,
  parsed_fields,
  summary,
  notes,
  hospital,
  date_of_birth,
  gender,
  medications
) VALUES
-- St. Mary's Hospital patients
(
  'John Smith',
  'medical_record_001.pdf',
  245000,
  'Medical Record',
  '{"fields": [{"label": "Patient ID", "value": "MR-2024-001"}, {"label": "Blood Type", "value": "O+"}, {"label": "Diagnosis", "value": "Hypertension"}]}'::jsonb,
  'Annual checkup with blood pressure monitoring',
  '["Follow-up in 3 months", "Diet and exercise recommended"]'::jsonb,
  'St. Mary''s Hospital',
  '1975-03-15',
  'Male',
  ARRAY['Lisinopril 10mg', 'Aspirin 81mg']
),
(
  'Sarah Johnson',
  'lab_results_002.pdf',
  189000,
  'Lab Results',
  '{"fields": [{"label": "Patient ID", "value": "MR-2024-002"}, {"label": "Test Type", "value": "Complete Blood Count"}, {"label": "Hemoglobin", "value": "13.5 g/dL"}]}'::jsonb,
  'Routine blood work showing normal results',
  '["All values within normal range"]'::jsonb,
  'St. Mary''s Hospital',
  '1988-07-22',
  'Female',
  ARRAY[]::TEXT[]
),
(
  'Michael Chen',
  'prescription_003.pdf',
  156000,
  'Prescription',
  '{"fields": [{"label": "Patient ID", "value": "MR-2024-003"}, {"label": "Medication", "value": "Metformin"}, {"label": "Dosage", "value": "500mg twice daily"}]}'::jsonb,
  'Diabetes management prescription',
  '["Monitor blood sugar levels", "Take with meals"]'::jsonb,
  'St. Mary''s Hospital',
  '1962-11-08',
  'Male',
  ARRAY['Metformin 500mg', 'Glipizide 5mg']
),
(
  'Emily Rodriguez',
  'discharge_summary_004.pdf',
  312000,
  'Discharge Summary',
  '{"fields": [{"label": "Patient ID", "value": "MR-2024-004"}, {"label": "Admission Date", "value": "2024-01-15"}, {"label": "Discharge Date", "value": "2024-01-18"}]}'::jsonb,
  'Post-surgical recovery from appendectomy',
  '["Wound care instructions provided", "Follow-up in 2 weeks"]'::jsonb,
  'St. Mary''s Hospital',
  '1995-04-30',
  'Female',
  ARRAY['Amoxicillin 500mg', 'Ibuprofen 400mg']
),
(
  'David Williams',
  'imaging_report_005.pdf',
  428000,
  'Imaging Report',
  '{"fields": [{"label": "Patient ID", "value": "MR-2024-005"}, {"label": "Study Type", "value": "Chest X-Ray"}, {"label": "Findings", "value": "Clear lungs, no abnormalities"}]}'::jsonb,
  'Routine chest x-ray for pre-employment physical',
  '["No follow-up needed"]'::jsonb,
  'St. Mary''s Hospital',
  '1980-09-12',
  'Male',
  ARRAY[]::TEXT[]
),

-- City General Hospital patients
(
  'Jennifer Martinez',
  'medical_record_006.pdf',
  267000,
  'Medical Record',
  '{"fields": [{"label": "Patient ID", "value": "CG-2024-001"}, {"label": "Chief Complaint", "value": "Seasonal allergies"}, {"label": "Treatment", "value": "Antihistamine prescribed"}]}'::jsonb,
  'Allergy consultation and treatment plan',
  '["Avoid known allergens", "Use air purifier at home"]'::jsonb,
  'City General Hospital',
  '1992-06-18',
  'Female',
  ARRAY['Cetirizine 10mg', 'Fluticasone nasal spray']
),
(
  'Robert Taylor',
  'cardiology_report_007.pdf',
  389000,
  'Cardiology Report',
  '{"fields": [{"label": "Patient ID", "value": "CG-2024-002"}, {"label": "Test", "value": "ECG"}, {"label": "Result", "value": "Normal sinus rhythm"}]}'::jsonb,
  'Cardiac evaluation showing healthy heart function',
  '["Continue current medications", "Annual follow-up recommended"]'::jsonb,
  'City General Hospital',
  '1958-02-25',
  'Male',
  ARRAY['Atorvastatin 20mg', 'Metoprolol 50mg']
),
(
  'Lisa Anderson',
  'prenatal_checkup_008.pdf',
  198000,
  'Prenatal Checkup',
  '{"fields": [{"label": "Patient ID", "value": "CG-2024-003"}, {"label": "Gestational Age", "value": "24 weeks"}, {"label": "Fetal Heart Rate", "value": "145 bpm"}]}'::jsonb,
  'Routine prenatal visit with ultrasound',
  '["Mother and baby healthy", "Next visit in 4 weeks"]'::jsonb,
  'City General Hospital',
  '1990-12-05',
  'Female',
  ARRAY['Prenatal vitamins']
),
(
  'James Wilson',
  'orthopedic_consult_009.pdf',
  345000,
  'Orthopedic Consultation',
  '{"fields": [{"label": "Patient ID", "value": "CG-2024-004"}, {"label": "Injury", "value": "Sprained ankle"}, {"label": "Treatment", "value": "RICE protocol"}]}'::jsonb,
  'Sports injury evaluation and treatment plan',
  '["Physical therapy recommended", "Return to activity in 4-6 weeks"]'::jsonb,
  'City General Hospital',
  '1985-08-14',
  'Male',
  ARRAY['Naproxen 500mg']
),
(
  'Maria Garcia',
  'diabetes_screening_010.pdf',
  223000,
  'Screening Results',
  '{"fields": [{"label": "Patient ID", "value": "CG-2024-005"}, {"label": "HbA1c", "value": "5.4%"}, {"label": "Fasting Glucose", "value": "92 mg/dL"}]}'::jsonb,
  'Diabetes screening showing normal glucose levels',
  '["No diabetes detected", "Maintain healthy lifestyle"]'::jsonb,
  'City General Hospital',
  '1978-03-28',
  'Female',
  ARRAY[]::TEXT[]
),

-- Memorial Medical Center patients
(
  'Christopher Brown',
  'emergency_visit_011.pdf',
  412000,
  'Emergency Visit',
  '{"fields": [{"label": "Patient ID", "value": "MM-2024-001"}, {"label": "Chief Complaint", "value": "Chest pain"}, {"label": "Diagnosis", "value": "Gastroesophageal reflux"}]}'::jsonb,
  'ER visit for chest pain, cardiac causes ruled out',
  '["Prescribed antacids", "Follow-up with primary care"]'::jsonb,
  'Memorial Medical Center',
  '1970-11-20',
  'Male',
  ARRAY['Omeprazole 20mg']
),
(
  'Amanda Lee',
  'physical_therapy_012.pdf',
  178000,
  'Physical Therapy Note',
  '{"fields": [{"label": "Patient ID", "value": "MM-2024-002"}, {"label": "Session", "value": "Week 3 of 6"}, {"label": "Progress", "value": "Good improvement in range of motion"}]}'::jsonb,
  'Post-surgical physical therapy progress note',
  '["Continue exercises at home", "Next session in 3 days"]'::jsonb,
  'Memorial Medical Center',
  '1987-05-17',
  'Female',
  ARRAY[]::TEXT[]
),
(
  'Daniel Kim',
  'mental_health_013.pdf',
  234000,
  'Mental Health Assessment',
  '{"fields": [{"label": "Patient ID", "value": "MM-2024-003"}, {"label": "Diagnosis", "value": "Generalized Anxiety Disorder"}, {"label": "Treatment Plan", "value": "Therapy and medication"}]}'::jsonb,
  'Initial psychiatric evaluation and treatment planning',
  '["Weekly therapy sessions scheduled", "Medication to be reviewed in 4 weeks"]'::jsonb,
  'Memorial Medical Center',
  '1993-09-03',
  'Male',
  ARRAY['Sertraline 50mg']
),
(
  'Patricia White',
  'mammogram_014.pdf',
  356000,
  'Mammogram Report',
  '{"fields": [{"label": "Patient ID", "value": "MM-2024-004"}, {"label": "Study Date", "value": "2024-01-20"}, {"label": "Findings", "value": "No suspicious masses"}]}'::jsonb,
  'Annual screening mammogram with normal results',
  '["Continue annual screenings", "No follow-up needed"]'::jsonb,
  'Memorial Medical Center',
  '1965-07-09',
  'Female',
  ARRAY[]::TEXT[]
),
(
  'Kevin Thompson',
  'sleep_study_015.pdf',
  467000,
  'Sleep Study Report',
  '{"fields": [{"label": "Patient ID", "value": "MM-2024-005"}, {"label": "Study Type", "value": "Polysomnography"}, {"label": "Diagnosis", "value": "Moderate sleep apnea"}]}'::jsonb,
  'Overnight sleep study showing sleep apnea',
  '["CPAP therapy recommended", "Follow-up in 1 month"]'::jsonb,
  'Memorial Medical Center',
  '1972-12-31',
  'Male',
  ARRAY[]::TEXT[]
),

-- Riverside Health Center patients
(
  'Michelle Davis',
  'vaccination_record_016.pdf',
  145000,
  'Vaccination Record',
  '{"fields": [{"label": "Patient ID", "value": "RH-2024-001"}, {"label": "Vaccine", "value": "Influenza"}, {"label": "Date Administered", "value": "2024-01-10"}]}'::jsonb,
  'Annual flu vaccination administered',
  '["No adverse reactions", "Next flu shot due in 1 year"]'::jsonb,
  'Riverside Health Center',
  '1998-02-14',
  'Female',
  ARRAY[]::TEXT[]
),
(
  'Brian Miller',
  'dermatology_consult_017.pdf',
  289000,
  'Dermatology Consultation',
  '{"fields": [{"label": "Patient ID", "value": "RH-2024-002"}, {"label": "Condition", "value": "Eczema"}, {"label": "Treatment", "value": "Topical corticosteroid"}]}'::jsonb,
  'Skin condition evaluation and treatment',
  '["Apply cream twice daily", "Avoid irritants", "Follow-up in 6 weeks"]'::jsonb,
  'Riverside Health Center',
  '1983-10-22',
  'Male',
  ARRAY['Hydrocortisone cream 1%']
),
(
  'Nicole Harris',
  'pediatric_checkup_018.pdf',
  167000,
  'Pediatric Checkup',
  '{"fields": [{"label": "Patient ID", "value": "RH-2024-003"}, {"label": "Age", "value": "8 years"}, {"label": "Height", "value": "127 cm"}, {"label": "Weight", "value": "26 kg"}]}'::jsonb,
  'Well-child visit with growth assessment',
  '["Growth and development on track", "Next visit in 1 year"]'::jsonb,
  'Riverside Health Center',
  '2016-04-08',
  'Female',
  ARRAY[]::TEXT[]
),
(
  'Steven Clark',
  'colonoscopy_report_019.pdf',
  398000,
  'Colonoscopy Report',
  '{"fields": [{"label": "Patient ID", "value": "RH-2024-004"}, {"label": "Procedure Date", "value": "2024-01-25"}, {"label": "Findings", "value": "One small polyp removed"}]}'::jsonb,
  'Screening colonoscopy with polyp removal',
  '["Pathology pending", "Repeat in 5 years"]'::jsonb,
  'Riverside Health Center',
  '1964-06-30',
  'Male',
  ARRAY[]::TEXT[]
),
(
  'Karen Martinez',
  'thyroid_test_020.pdf',
  201000,
  'Thyroid Function Test',
  '{"fields": [{"label": "Patient ID", "value": "RH-2024-005"}, {"label": "TSH", "value": "2.5 mIU/L"}, {"label": "T4", "value": "1.2 ng/dL"}]}'::jsonb,
  'Thyroid function testing showing normal levels',
  '["No thyroid dysfunction detected", "Recheck in 1 year"]'::jsonb,
  'Riverside Health Center',
  '1981-01-19',
  'Female',
  ARRAY[]::TEXT[]
);
