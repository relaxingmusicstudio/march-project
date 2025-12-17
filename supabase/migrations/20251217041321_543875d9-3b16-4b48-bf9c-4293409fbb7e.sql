-- Create unified view for action_queue and ceo_action_queue
-- GOVERNANCE: Single source of truth for all queued actions

CREATE OR REPLACE VIEW public.queue_unified AS
SELECT 
  id,
  'action_queue'::text AS source_table,
  agent_type,
  action_type,
  target_type,
  target_id::text AS target_id,
  COALESCE(status, 'pending_approval') AS status,
  COALESCE(priority, 5) AS priority,
  created_at,
  NULL::timestamptz AS reviewed_at,
  NULL::text AS claude_reasoning,
  action_payload
FROM public.action_queue

UNION ALL

SELECT 
  id,
  'ceo_action_queue'::text AS source_table,
  COALESCE(source, 'ceo-agent')::text AS agent_type,
  action_type,
  target_type,
  target_id::text AS target_id,
  COALESCE(status, 'pending_approval') AS status,
  CASE 
    WHEN priority IS NULL THEN 5
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

-- Add comment for documentation
COMMENT ON VIEW public.queue_unified IS 'Unified view of action_queue and ceo_action_queue for governance dashboard. GOVERNANCE: All statuses must be pending_approval, approved, rejected, modified, or conflicted.';

-- Grant access to authenticated users
GRANT SELECT ON public.queue_unified TO authenticated;
GRANT SELECT ON public.queue_unified TO anon;