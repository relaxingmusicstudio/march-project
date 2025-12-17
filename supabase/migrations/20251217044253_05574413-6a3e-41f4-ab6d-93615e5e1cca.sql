-- Create tenant status enum
CREATE TYPE public.tenant_status AS ENUM ('draft', 'active', 'suspended');

-- Create tenant plan enum  
CREATE TYPE public.tenant_plan AS ENUM ('starter', 'growth', 'scale');