-- Migration 3: Enhance orchestration_tasks for delegation workflow
DO $$
BEGIN
  IF to_regclass('public.orchestration_tasks') IS NOT NULL THEN
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS brief jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS output jsonb;
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS output_type text;
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT true;
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS approved_at timestamptz;
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS approved_by uuid;
    ALTER TABLE public.orchestration_tasks ADD COLUMN IF NOT EXISTS discussion_thread jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
