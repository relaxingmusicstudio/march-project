import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      tenant_id,
      template_key,
      business_dna,
      business_profile,
      ai_system_prompt,
      seed_demo_data = true 
    } = await req.json();

    console.log('Provisioning business:', { tenant_id, template_key });

    // 1. Get the template
    const { data: template, error: templateError } = await supabase
      .from('business_templates')
      .select('*')
      .eq('template_key', template_key)
      .single();

    if (templateError && templateError.code !== 'PGRST116') {
      console.error('Template error:', templateError);
    }

    // 2. Update or create tenant record
    let targetTenantId = tenant_id;
    
    if (targetTenantId) {
      // Update existing tenant
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          company_name: business_dna?.business_name || business_profile?.business_name,
          industry: business_dna?.industry || template_key,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetTenantId);

      if (tenantError) {
        console.error('Tenant update error:', tenantError);
      }
    } else {
      // Create new tenant
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          company_name: business_dna?.business_name || business_profile?.business_name || 'New Business',
          industry: business_dna?.industry || template_key,
          subscription_plan: 'starter',
          is_active: true
        })
        .select()
        .single();

      if (tenantError) {
        throw new Error(`Failed to create tenant: ${tenantError.message}`);
      }
      targetTenantId = newTenant.id;
    }

    // 3. Upsert business_dna
    if (business_dna) {
      const dnaData = {
        tenant_id: targetTenantId,
        business_name: business_dna.business_name || 'My Business',
        industry: business_dna.industry || template_key,
        business_model: business_dna.business_model || 'local_service',
        target_customer: business_dna.target_customer || {},
        brand_voice: business_dna.brand_voice || { tone: 'professional', formality: 'friendly' },
        products_services: business_dna.products_services || template?.default_services || [],
        unique_value_proposition: business_dna.unique_value_proposition || '',
        competitors: business_dna.competitors || [],
        average_deal_value: business_dna.avg_job_value || template?.base_config?.default_job_value || 351,
        sales_cycle_days: business_dna.sales_cycle_days || 7,
        scenario_key: template_key
      };

      // Check if business_dna exists for this tenant
      const { data: existingDna } = await supabase
        .from('business_dna')
        .select('id')
        .eq('tenant_id', targetTenantId)
        .single();

      if (existingDna) {
        const { error: dnaError } = await supabase
          .from('business_dna')
          .update(dnaData)
          .eq('tenant_id', targetTenantId);

        if (dnaError) {
          console.error('DNA update error:', dnaError);
        }
      } else {
        const { error: dnaError } = await supabase
          .from('business_dna')
          .insert(dnaData);

        if (dnaError) {
          console.error('DNA insert error:', dnaError);
        }
      }
    }

    // 4. Upsert business_profile
    if (business_profile) {
      const profileData = {
        tenant_id: targetTenantId,
        business_name: business_profile.business_name || business_dna?.business_name,
        industry: business_profile.industry || business_dna?.industry || template_key,
        services: business_profile.services || [],
        avg_job_value: business_profile.avg_job_value || business_dna?.avg_job_value || 351,
        monthly_call_volume: business_profile.monthly_call_volume || 80,
        service_area: business_profile.service_area || '',
        phone: business_profile.phone || '',
        email: business_profile.email || '',
        website: business_profile.website || '',
        address: business_profile.address || '',
        timezone: business_profile.timezone || 'America/New_York',
        business_hours: business_profile.business_hours || {
          start: '08:00',
          end: '18:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        },
        unique_selling_points: business_profile.unique_selling_points || business_dna?.unique_value_proposition ? [business_dna.unique_value_proposition] : [],
        pain_points: business_profile.pain_points || business_dna?.target_customer?.pain_points || [],
        brand_voice: business_profile.brand_voice || business_dna?.brand_voice || {},
        ai_preferences: {
          tone: 'professional',
          personality: 'helpful',
          responseLength: 'concise',
          custom_prompt: ai_system_prompt || template?.ai_system_prompt || ''
        }
      };

      // Check if business_profile exists for this tenant
      const { data: existingProfile } = await supabase
        .from('business_profile')
        .select('id')
        .eq('tenant_id', targetTenantId)
        .single();

      if (existingProfile) {
        const { error: profileError } = await supabase
          .from('business_profile')
          .update(profileData)
          .eq('tenant_id', targetTenantId);

        if (profileError) {
          console.error('Profile update error:', profileError);
        }
      } else {
        const { error: profileError } = await supabase
          .from('business_profile')
          .insert(profileData);

        if (profileError) {
          console.error('Profile insert error:', profileError);
        }
      }
    }

    // 5. Create deployment record
    const { error: deployError } = await supabase
      .from('deployments')
      .insert({
        tenant_id: targetTenantId,
        template_id: template?.id,
        environment: 'production',
        config_overrides: {
          ai_system_prompt,
          customizations: business_profile
        },
        status: 'active',
        deployed_at: new Date().toISOString()
      });

    if (deployError) {
      console.error('Deployment record error:', deployError);
    }

    // 6. Optionally seed demo data
    if (seed_demo_data) {
      try {
        // Call the seed-mock-tenant function
        const seedResponse = await fetch(`${supabaseUrl}/functions/v1/seed-mock-tenant`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tenant_id: targetTenantId,
            scenario: template_key || 'hvac'
          })
        });

        if (!seedResponse.ok) {
          console.warn('Seed data warning:', await seedResponse.text());
        }
      } catch (seedError) {
        console.warn('Could not seed demo data:', seedError);
      }
    }

    // 7. Log the provisioning
    await supabase.from('automation_logs').insert({
      function_name: 'provision-new-business',
      status: 'completed',
      metadata: {
        tenant_id: targetTenantId,
        template_key,
        seeded: seed_demo_data
      },
      items_processed: 1,
      items_created: 1,
      completed_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      tenant_id: targetTenantId,
      template_key,
      message: 'Business provisioned successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in provision-new-business:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
