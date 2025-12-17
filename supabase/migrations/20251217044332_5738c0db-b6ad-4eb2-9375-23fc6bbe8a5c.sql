-- RLS policies for tenant_templates
CREATE POLICY "Anyone can view active templates"
  ON public.tenant_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins can manage templates"
  ON public.tenant_templates FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Function to check platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
$$;

-- Function to get tenant status
CREATE OR REPLACE FUNCTION public.get_user_tenant_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.status::text 
  FROM public.tenants t
  INNER JOIN public.profiles p ON p.tenant_id = t.id
  WHERE p.id = auth.uid()
$$;

-- RLS on ceo_action_queue for tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for ceo_action_queue" ON public.ceo_action_queue;
CREATE POLICY "Tenant isolation for ceo_action_queue"
  ON public.ceo_action_queue FOR ALL
  USING ((tenant_id = get_user_tenant_id()) OR (tenant_id IS NULL) OR is_platform_admin());

-- Platform admin policies on tenants
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON public.tenants;
CREATE POLICY "Platform admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can manage tenants" ON public.tenants;
CREATE POLICY "Platform admins can manage tenants"
  ON public.tenants FOR ALL
  USING (is_platform_admin());

-- Provision tenant function
CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_name text,
  p_owner_user_id uuid,
  p_template_key text DEFAULT 'base',
  p_plan tenant_plan DEFAULT 'starter'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_template tenant_templates%ROWTYPE;
  v_slug text;
BEGIN
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '_', 'g'));
  SELECT * INTO v_template FROM tenant_templates WHERE template_key = p_template_key;
  
  INSERT INTO tenants (name, slug, owner_user_id, template_source, plan, status, settings)
  VALUES (p_name, v_slug || '_' || substr(gen_random_uuid()::text, 1, 8), p_owner_user_id, p_template_key, p_plan, 'draft', COALESCE(v_template.default_settings, '{}'::jsonb))
  RETURNING id INTO v_tenant_id;
  
  UPDATE profiles SET tenant_id = v_tenant_id WHERE id = p_owner_user_id;
  
  INSERT INTO business_dna (tenant_id, business_name, industry, brand_voice)
  SELECT v_tenant_id, p_name, 
    COALESCE(v_template.default_business_dna->>'industry', 'general'),
    COALESCE(v_template.default_business_dna->'brand_voice', '{"tone": "professional"}'::jsonb);
  
  INSERT INTO business_profile (tenant_id, business_name, industry)
  SELECT v_tenant_id, p_name,
    COALESCE(v_template.default_business_dna->>'industry', 'general');
  
  RETURN v_tenant_id;
END;
$$;

-- Activate tenant function
CREATE OR REPLACE FUNCTION public.activate_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tenants 
  SET status = 'active', initialized_at = now()
  WHERE id = p_tenant_id AND status = 'draft';
  RETURN FOUND;
END;
$$;

-- Updated handle_new_user with tenant provisioning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_tenant_id uuid;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_display_name);
  
  v_tenant_id := provision_tenant(
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', v_display_name || '''s Business'),
    NEW.id,
    'base',
    'starter'
  );
  
  RETURN NEW;
END;
$$;