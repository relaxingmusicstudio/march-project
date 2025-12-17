import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useTenant } from "@/hooks/useTenant";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  skipOnboardingCheck?: boolean;
  skipTenantCheck?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  skipOnboardingCheck = false,
  skipTenantCheck = false 
}: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const { isNewUser, isLoading: onboardingLoading } = useOnboardingStatus();
  const { 
    tenantStatus, 
    needsInitialization, 
    isSuspendedTenant,
    isPlatformAdmin,
    isLoading: tenantLoading 
  } = useTenant();

  const isLoading = authLoading || onboardingLoading || tenantLoading;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, isLoading, navigate]);

  // MULTI-TENANT: Redirect DRAFT tenants to CEO chat for initialization
  // Platform admins can bypass this
  useEffect(() => {
    if (!isLoading && isAuthenticated && !skipTenantCheck && !skipOnboardingCheck) {
      // Draft tenants must complete CEO-driven initialization
      if (needsInitialization && !location.pathname.startsWith("/app/onboarding")) {
        navigate("/app/onboarding");
      }
    }
  }, [needsInitialization, isLoading, isAuthenticated, skipTenantCheck, skipOnboardingCheck, location.pathname, navigate]);

  // GOVERNANCE #5: Redirect NEW users to onboarding conversation
  // Only for /app route, not for the onboarding page itself
  useEffect(() => {
    if (!isLoading && isAuthenticated && !skipOnboardingCheck) {
      if (isNewUser && location.pathname === "/app") {
        navigate("/app/onboarding");
      }
    }
  }, [isNewUser, isLoading, isAuthenticated, skipOnboardingCheck, location.pathname, navigate]);

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
    return null; // Will redirect via useEffect
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

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. Only administrators can view the CEO Agent dashboard.
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

  return <>{children}</>;
};

export default ProtectedRoute;
