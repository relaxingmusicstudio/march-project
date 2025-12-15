-- Migration 3: Enhance orchestration_tasks for delegation workflow
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS brief jsonb DEFAULT '{}'::jsonb;
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS output jsonb;
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS output_type text;
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT true;
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE orchestration_tasks ADD COLUMN IF NOT EXISTS discussion_thread jsonb DEFAULT '[]'::jsonb;