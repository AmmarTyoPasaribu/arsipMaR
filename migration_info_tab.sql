-- Migration: Add payment, recovery_email, and sort_order to emails table
-- Run this in Supabase SQL Editor

-- Add payment info column
ALTER TABLE emails ADD COLUMN IF NOT EXISTS payment text DEFAULT '';

-- Add recovery email column  
ALTER TABLE emails ADD COLUMN IF NOT EXISTS recovery_email text DEFAULT '';

-- Add sort_order for manual ordering
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Set initial sort_order based on created_at (oldest = 1, newest = last)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as rn
  FROM emails
)
UPDATE emails SET sort_order = ordered.rn FROM ordered WHERE emails.id = ordered.id;
