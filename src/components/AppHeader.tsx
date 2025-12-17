/**
 * AppHeader - Application header with notifications and user menu
 * 
 * Features:
 * - App logo/name
 * - Back to Site link (optional)
 * - Notifications icon
 * - User menu (Account, Sign out)
 */

import { Link } from "react-router-dom";
import { Bell, User, LogOut, Settings, Phone, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";

export function AppHeader() {
  const { signOut, user } = useAuth();
  const { homeRoute, isClient } = useRoleNavigation();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo / Home */}
        <Link to={homeRoute} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Phone className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">
            {isClient ? "Client Portal" : "Command Center"}
          </span>
        </Link>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Back to Site */}
          <Button variant="ghost" size="sm" asChild className="hidden md:flex">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <Home className="w-4 h-4 mr-1" />
              Back to Site
            </Link>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {/* Notification badge - show when there are unread notifications */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {user?.email}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/settings" className="flex items-center cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
