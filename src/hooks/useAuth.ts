import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "moderator" | "user";

/**
 * useAuth — STABLE VERSION
 * - No PowerShell artifacts
 * - No direct profiles table queries (avoids 406 loop)
 * - Tenant resolved via RPC
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const tenantPromise = useRef<Promise<string | null> | null>(null);

  const resolveTenant = useCallback(async (sess: Session | null) => {
    if (!sess?.user) {
      setTenantId(null);
      return null;
    }

    const existing = (sess.user.user_metadata as any)?.tenant_id;
    if (existing) {
      setTenantId(existing);
      setUser(sess.user);
      return existing;
    }

    if (tenantPromise.current) return tenantPromise.current;

    tenantPromise.current = (async () => {
      const { data, error } = await supabase.rpc("get_user_tenant_id");
      if (error) {
        console.error("get_user_tenant_id failed", error);
        return null;
      }

      const tid = String(data);
      setTenantId(tid);

      const patchedUser: User = {
        ...sess.user,
        user_metadata: {
          ...(sess.user.user_metadata ?? {}),
          tenant_id: tid,
        },
      };

      setUser(patchedUser);
      tenantPromise.current = null;
      return tid;
    })();

    return tenantPromise.current;
  }, []);

  const checkAdminRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin" as AppRole,
    });

    if (error) {
      console.warn("has_role error", error);
      return false;
    }

    return data === true;
  }, []);

  const applySession = useCallback(
    async (sess: Session | null) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setIsLoading(false);

      if (!sess?.user) {
        setIsAdmin(false);
        setTenantId(null);
        return;
      }

      await resolveTenant(sess);
      checkAdminRole(sess.user.id).then(setIsAdmin);
    },
    [resolveTenant, checkAdminRole]
  );

  useEffect(() => {
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_e, sess) => {
        applySession(sess);
      });

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session ?? null);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  return {
    user,
    session,
    tenantId,
    isAdmin,
    isLoading,
    isAuthenticated: !!session,
  };
};
