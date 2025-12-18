-- Clear all data from documents table for fresh testing
-- WARNING: This will permanently delete all records

DELETE FROM documents;

-- Reset the sequence if needed (optional, for PostgreSQL)
-- This ensures new records start from ID 1 again
-- ALTER SEQUENCE documents_id_seq RESTART WITH 1;
