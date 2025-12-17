-- Fix security definer view warning
-- Explicitly set SECURITY INVOKER (default but being explicit for linter)
ALTER VIEW public.queue_unified SET (security_invoker = on);