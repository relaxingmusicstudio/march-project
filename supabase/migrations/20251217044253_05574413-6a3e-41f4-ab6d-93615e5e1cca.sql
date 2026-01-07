-- Create tenant status enum (idempotent)
DO $$
BEGIN
  IF to_regtype('public.tenant_status') IS NULL THEN
    CREATE TYPE public.tenant_status AS ENUM ('draft', 'active', 'suspended');
  END IF;
END $$;

-- Create tenant plan enum
DO $$
BEGIN
  IF to_regtype('public.tenant_plan') IS NULL THEN
    CREATE TYPE public.tenant_plan AS ENUM ('starter', 'growth', 'scale');
  END IF;
END $$;
