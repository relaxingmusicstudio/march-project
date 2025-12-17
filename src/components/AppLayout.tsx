/**
 * AppLayout - Main app shell with role-based navigation
 * 
 * Uses useRoleNavigation to show:
 * - Owner: Full CEO nav (Dashboard, Pipeline, Inbox, Analytics, etc.)
 * - Client: Portal-only nav (Portal, Messages, Deliverables, etc.)
 * 
 * TEST CHECKLIST:
 * - Owner sees full navigation
 * - Client sees portal-only navigation
 * - Navigation items highlight correctly on active route
 */

import { Outlet, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/AppHeader";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const location = useLocation();
  const { navItems, isLoading } = useRoleNavigation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed App Header */}
      <AppHeader />

      {/* Main content area with left nav */}
      <div className="pt-14 flex min-h-screen">
        {/* Left Navigation - Hidden on mobile */}
        <nav className="hidden md:flex flex-col w-56 border-r border-border bg-muted/30 fixed top-14 bottom-0 left-0 overflow-y-auto">
          <div className="p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/app" && item.href !== "/app/portal" && location.pathname.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 md:ml-56">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== "/app" && item.href !== "/app/portal" && location.pathname.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg min-w-0 flex-1",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default AppLayout;
