import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type TenantStatus = "draft" | "active" | "suspended";
export type TenantPlan = "starter" | "growth" | "scale";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  template_source: string;
  initialized_at: string | null;
  owner_user_id: string | null;
  created_at: string;
}

export const useTenant = () => {
  const { user, isAuthenticated } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const fetchTenantStatus = useCallback(async () => {
    if (!user) {
      setTenantStatus(null);
      setTenant(null);
      setIsLoading(false);
      return;
    }

    try {
      // Get tenant status via RPC
      const { data: statusData } = await supabase.rpc("get_user_tenant_status");
      setTenantStatus(statusData as TenantStatus);

      // Get full tenant data
      const { data: profileData } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileData?.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", profileData.tenant_id)
          .single();

        if (tenantData) {
          setTenant(tenantData as unknown as Tenant);
        }
      }

      // Check platform admin
      const { data: adminData } = await supabase.rpc("is_platform_admin");
      setIsPlatformAdmin(adminData === true);
    } catch (error) {
      console.error("Error fetching tenant:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenantStatus();
    } else {
      setTenant(null);
      setTenantStatus(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchTenantStatus]);

  const isDraftTenant = tenantStatus === "draft";
  const isActiveTenant = tenantStatus === "active";
  const isSuspendedTenant = tenantStatus === "suspended";

  // Check if user needs to complete initialization
  const needsInitialization = isDraftTenant && !isPlatformAdmin;

  const refreshTenant = useCallback(() => {
    setIsLoading(true);
    fetchTenantStatus();
  }, [fetchTenantStatus]);

  return {
    tenant,
    tenantStatus,
    isLoading,
    isDraftTenant,
    isActiveTenant,
    isSuspendedTenant,
    isPlatformAdmin,
    needsInitialization,
    refreshTenant,
  };
};
