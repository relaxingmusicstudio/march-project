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
import { useEffect, useState } from "react";
import { Bell, Bug, User, LogOut, Settings, Phone, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { describeFlightMode, loadFlightMode, saveFlightMode, type FlightMode } from "@/lib/flightMode";
import DebugProofPanel from "@/components/DebugProofPanel";

export function AppHeader() {
  const { signOut, userId, email } = useAuth();
  const { homeRoute, isClient } = useRoleNavigation();
  const [flightMode, setFlightMode] = useState<FlightMode>(() => loadFlightMode(userId, email));
  const [pendingMode, setPendingMode] = useState<FlightMode | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const liveLocked = true;

  const handleSignOut = async () => {
    await signOut();
  };

  useEffect(() => {
    setFlightMode(loadFlightMode(userId, email));
  }, [userId, email]);

  useEffect(() => {
    const update = () => setFlightMode(loadFlightMode(userId, email));
    window.addEventListener("ppp:flightmode", update);
    return () => window.removeEventListener("ppp:flightmode", update);
  }, [userId, email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readReady = () => {
      const raw = window.localStorage.getItem("ppp:preflight");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { ok?: boolean };
          return Boolean(parsed?.ok);
        } catch {
          // ignore parse failures
        }
      }
      return window.localStorage.getItem("ppp:preflightReady") === "true";
    };
    const update = () => setLiveReady(readReady());
    update();
    window.addEventListener("ppp:preflight", update);
    return () => window.removeEventListener("ppp:preflight", update);
  }, []);

  const requestMode = (mode: FlightMode) => {
    if (mode === "LIVE" && liveLocked) {
      setModeNotice("Live Mode is locked in SIM-only mode.");
      return;
    }
    setPendingMode(mode);
    setConfirmText("");
    setModeNotice(null);
    setConfirmOpen(true);
  };

  const cancelModeChange = () => {
    setPendingMode(null);
    setConfirmText("");
    setModeNotice(null);
    setConfirmOpen(false);
  };

  const confirmModeChange = () => {
    if (!pendingMode) return;
    if (pendingMode === "LIVE" && liveLocked) {
      setModeNotice("Live Mode is locked in SIM-only mode.");
      return;
    }
    if (pendingMode === "LIVE" && !liveReady) {
      setModeNotice("Live Mode requires preflight readiness.");
      return;
    }
    if (confirmText.trim().toUpperCase() !== pendingMode) {
      setModeNotice(`Type ${pendingMode} to confirm.`);
      return;
    }
    saveFlightMode(pendingMode, userId, email);
    setFlightMode(pendingMode);
    cancelModeChange();
  };

  const liveDisabledReason = liveLocked
    ? "Disabled: LIVE execution locked in SIM-only mode."
    : liveReady
      ? null
      : "Disabled: preflight checks not passed.";

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
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="hidden md:flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
                    data-testid="flight-mode-indicator"
                  >
                    {flightMode === "LIVE" ? "Live Flight" : "Sim Mode"}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Sim Mode has no real-world effects; Live Mode requires confirmation + preflight.
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-72">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {describeFlightMode(flightMode)}
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Live Mode is locked until preflight requirements are met.
              </div>
              <div className="flex flex-col gap-2 px-2 pb-2">
                <Button
                  variant={flightMode === "SIM" ? "default" : "outline"}
                  size="sm"
                  onClick={() => requestMode("SIM")}
                >
                  Sim Mode
                </Button>
                <Button
                  variant={flightMode === "LIVE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => requestMode("LIVE")}
                  disabled={liveLocked || !liveReady}
                  title={liveDisabledReason ?? undefined}
                >
                  Live Flight
                </Button>
                {(liveLocked || !liveReady) && (
                  <div className="text-[11px] text-amber-700">{liveDisabledReason}</div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="md:hidden rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-foreground">
                {flightMode === "LIVE" ? "LIVE" : "SIM"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Sim Mode has no real-world effects; Live Mode requires confirmation + preflight.
            </TooltipContent>
          </Tooltip>

          {/* Back to Site */}
          <Button variant="ghost" size="sm" asChild className="hidden md:flex">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <Home className="w-4 h-4 mr-1" />
              Back to Site
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex"
            onClick={() => setDebugOpen(true)}
            title="Open Debug Proof Panel"
          >
            <Bug className="w-4 h-4 mr-1" />
            Debug
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
                {email ?? "unknown"}
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
      <DebugProofPanel open={debugOpen} onOpenChange={setDebugOpen} flightModeLabel={flightMode} />
      <AlertDialog
        open={confirmOpen && Boolean(pendingMode)}
        onOpenChange={(open) => {
          if (!open) {
            cancelModeChange();
          } else {
            setConfirmOpen(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {pendingMode} Mode</AlertDialogTitle>
            <AlertDialogDescription>
              Type {pendingMode} to acknowledge and switch modes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            className="w-full rounded-md border border-border px-2 py-1 text-sm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
          />
          {modeNotice && <div className="text-xs text-amber-700">{modeNotice}</div>}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelModeChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmModeChange();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

export default AppHeader;
