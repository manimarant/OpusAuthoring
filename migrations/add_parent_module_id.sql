-- Migration: Add parent_module_id column to modules table
-- This allows chapters to reference their parent module

-- Add the parent_module_id column
ALTER TABLE modules ADD COLUMN IF NOT EXISTS parent_module_id VARCHAR REFERENCES modules(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_modules_parent_module_id ON modules(parent_module_id);

-- Add index on course_id and parent_module_id for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_modules_course_parent ON modules(course_id, parent_module_id);
