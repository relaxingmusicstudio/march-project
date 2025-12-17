/**
 * Hook to get user's role from user_roles table
 * Returns 'owner' or 'client' for role-based routing
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserRole = "owner" | "client" | "admin" | "moderator" | "user" | null;

export function useUserRole() {
  const { user, isLoading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        // Check user_roles table for the user's role
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error);
          // Default to 'owner' if no role found (for existing users)
          setRole("owner");
        } else if (data) {
          setRole(data.role as UserRole);
        } else {
          // No role assigned - default to 'owner' for new users
          setRole("owner");
        }
      } catch (error) {
        console.error("Error in useUserRole:", error);
        setRole("owner");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, [user, authLoading]);

  return {
    role,
    isOwner: role === "owner" || role === "admin",
    isClient: role === "client",
    isAdmin: role === "admin",
    isLoading: authLoading || isLoading,
  };
}
