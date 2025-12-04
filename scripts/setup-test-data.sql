-- Test Data Setup Script for Family Voice Bridge
-- Run this in your PostgreSQL database before testing

-- 1. Create test household
INSERT INTO households (id, name, timezone)
VALUES ('00000000-0000-0000-0000-000000000000', 'Test Family', 'America/New_York')
ON CONFLICT (id) DO NOTHING;

-- 2. Create test users
INSERT INTO users (id, household_id, display_name, family_role, primary_lang, is_primary)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Mom', 'mom', 'zh-CN', true),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Partner', 'partner', 'en-US', false)
ON CONFLICT (id) DO NOTHING;

-- Verify data was created
SELECT 'Households:' as info;
SELECT id, name, timezone FROM households WHERE id = '00000000-0000-0000-0000-000000000000';

SELECT 'Users:' as info;
SELECT id, display_name, family_role, primary_lang FROM users WHERE household_id = '00000000-0000-0000-0000-000000000000';

