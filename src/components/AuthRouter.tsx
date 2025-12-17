/**
 * AuthRouter - Central routing logic for authenticated users
 * 
 * Routing rules:
 * 1. NOT authenticated -> /auth (login screen)
 * 2. Authenticated + onboarding_complete = false -> /app/onboarding
 * 3. Authenticated + onboarding_complete = true + role = owner -> /app (CEO Home)
 * 4. Authenticated + onboarding_complete = true + role = client -> /app/portal (Client Portal)
 */

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useUserRole } from "@/hooks/useUserRole";

interface AuthRouterProps {
  children: React.ReactNode;
}

export function AuthRouter({ children }: AuthRouterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isOnboardingComplete, isLoading: onboardingLoading } = useOnboardingStatus();
  const { isClient, isLoading: roleLoading } = useUserRole();
  const [hasNavigated, setHasNavigated] = useState(false);

  const isLoading = authLoading || onboardingLoading || roleLoading;

  useEffect(() => {
    if (isLoading || hasNavigated) return;

    // Rule 1: Not authenticated -> go to auth
    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      setHasNavigated(true);
      return;
    }

    // Rule 2: Not completed onboarding -> go to onboarding
    if (isOnboardingComplete === false) {
      if (location.pathname !== "/app/onboarding") {
        navigate("/app/onboarding", { replace: true });
        setHasNavigated(true);
      }
      return;
    }

    // Rule 3: Completed onboarding, determine destination by role
    if (isOnboardingComplete === true) {
      // Client role goes to client portal
      if (isClient) {
        if (!location.pathname.startsWith("/app/portal")) {
          navigate("/app/portal", { replace: true });
          setHasNavigated(true);
        }
        return;
      }

      // Owner/admin goes to CEO Home
      if (location.pathname === "/app/onboarding") {
        navigate("/app", { replace: true });
        setHasNavigated(true);
      }
    }
  }, [isAuthenticated, isOnboardingComplete, isClient, isLoading, hasNavigated, location.pathname, navigate]);

  // Reset navigation flag when location changes externally
  useEffect(() => {
    setHasNavigated(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default AuthRouter;
