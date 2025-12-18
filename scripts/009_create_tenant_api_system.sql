-- Create tenants table for multi-tenant API access
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processing_jobs table to track async document processing
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  callback_url TEXT,
  callback_attempts INT DEFAULT 0,
  callback_last_attempt TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add tenant_id to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants(api_key);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_tenant_id ON processing_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);

-- Insert a demo tenant for testing
INSERT INTO tenants (name, api_key, webhook_url, is_active) 
VALUES ('Demo Healthcare TPA', 'demo_api_key_12345', 'https://example.com/webhook', true)
ON CONFLICT (api_key) DO NOTHING;
