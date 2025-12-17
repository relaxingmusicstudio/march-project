/**
 * ProtectedRoute - Route guard with role-based access control
 * 
 * Props:
 * - requireOwner: Only allow owner/admin roles
 * - requireClient: Only allow client role
 * - requireAdmin: Only allow platform admin
 * - skipOnboardingCheck: Don't redirect to onboarding
 */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireOwner?: boolean;
  requireClient?: boolean;
  skipOnboardingCheck?: boolean;
  skipTenantCheck?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireOwner = false,
  requireClient = false,
  skipOnboardingCheck = false,
  skipTenantCheck = false 
}: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const { isOnboardingComplete, isLoading: onboardingLoading } = useOnboardingStatus();
  const { isOwner, isClient, isLoading: roleLoading } = useUserRole();
  const { 
    needsInitialization, 
    isSuspendedTenant,
    isPlatformAdmin,
    isLoading: tenantLoading 
  } = useTenant();

  const isLoading = authLoading || onboardingLoading || tenantLoading || roleLoading;

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!isLoading && isAuthenticated && !skipOnboardingCheck) {
      if (isOnboardingComplete === false && location.pathname !== "/app/onboarding") {
        navigate("/app/onboarding", { replace: true });
      }
    }
  }, [isOnboardingComplete, isLoading, isAuthenticated, skipOnboardingCheck, location.pathname, navigate]);

  // Role-based routing for completed onboarding
  useEffect(() => {
    if (!isLoading && isAuthenticated && isOnboardingComplete === true) {
      // Client trying to access owner-required pages -> redirect to portal
      if (isClient && requireOwner) {
        navigate("/app/portal", { replace: true });
        return;
      }
      
      // Owner on onboarding page after completion -> redirect to CEO Home
      if (isOwner && location.pathname === "/app/onboarding") {
        navigate("/app", { replace: true });
        return;
      }
    }
  }, [isClient, isOwner, isOnboardingComplete, isLoading, isAuthenticated, requireOwner, location.pathname, navigate]);

  // MULTI-TENANT: Redirect DRAFT tenants to onboarding
  useEffect(() => {
    if (!isLoading && isAuthenticated && !skipTenantCheck && !skipOnboardingCheck) {
      if (needsInitialization && !location.pathname.startsWith("/app/onboarding")) {
        navigate("/app/onboarding", { replace: true });
      }
    }
  }, [needsInitialization, isLoading, isAuthenticated, skipTenantCheck, skipOnboardingCheck, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Show suspended tenant message
  if (isSuspendedTenant && !isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <Building2 className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Account Suspended</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been suspended. Please contact support for assistance.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Go Home
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. Only administrators can view this page.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/app")}>
              Go to Dashboard
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (requireOwner && !isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            This page is only available to account owners.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/app/portal")}>
              Go to Portal
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (requireClient && !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            This page is only available to client accounts.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/app")}>
              Go to Dashboard
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
