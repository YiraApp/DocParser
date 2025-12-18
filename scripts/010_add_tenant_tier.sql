-- Add tier column to tenants table for queue limit management
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free';

-- Add index for faster tier-based queries
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);

-- Update existing tenants to have a tier
UPDATE tenants 
SET tier = 'basic' 
WHERE tier IS NULL;

-- Add comment
COMMENT ON COLUMN tenants.tier IS 'Subscription tier: free, basic, pro, enterprise';
