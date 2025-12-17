-- Add claude_reasoning column to action_queue for parity with ceo_action_queue
ALTER TABLE public.action_queue ADD COLUMN IF NOT EXISTS claude_reasoning text;

-- Recreate queue_unified view with claude_reasoning from both tables
CREATE OR REPLACE VIEW public.queue_unified AS
SELECT
  id,
  'action_queue'::text AS source_table,
  agent_type,
  action_type,
  target_type,
  target_id::text,
  COALESCE(status, 'pending_approval') AS status,
  COALESCE(priority, 5) AS priority,
  created_at,
  reviewed_at,
  claude_reasoning,
  action_payload
FROM public.action_queue
UNION ALL
SELECT
  id,
  'ceo_action_queue'::text AS source_table,
  COALESCE(source, 'ceo-agent') AS agent_type,
  action_type,
  target_type,
  target_id::text,
  COALESCE(status, 'pending_approval') AS status,
  CASE 
    WHEN priority ~ '^\d+$' THEN priority::int
    WHEN priority = 'high' THEN 8
    WHEN priority = 'critical' THEN 10
    WHEN priority = 'low' THEN 3
    ELSE 5
  END AS priority,
  created_at,
  reviewed_at,
  claude_reasoning,
  payload AS action_payload
FROM public.ceo_action_queue;

-- Maintain security invoker setting
ALTER VIEW public.queue_unified SET (security_invoker = on);