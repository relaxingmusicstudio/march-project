import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, 
  Terminal, 
  RefreshCw, 
  Settings,
  Activity,
  ChevronRight,
  Home
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WorkspaceTab {
  id: "ceo" | "command-center";
  label: string;
  icon: typeof Bot;
  description: string;
  basePath: string;
}

const WORKSPACE_TABS: WorkspaceTab[] = [
  {
    id: "ceo",
    label: "AI CEO",
    icon: Bot,
    description: "Strategic dashboard & insights",
    basePath: "/app/ceo",
  },
  {
    id: "command-center",
    label: "Command Center",
    icon: Terminal,
    description: "Operations & data management",
    basePath: "/app/command-center",
  },
];

export default function DualWorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [systemHealth, setSystemHealth] = useState<"healthy" | "warning" | "critical">("healthy");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Determine active tab from current path
  const activeTab = location.pathname.startsWith("/app/command-center") ? "command-center" : "ceo";

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const { data } = await supabase
        .from("automation_logs")
        .select("status")
        .gte("started_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (data) {
        const failedCount = data.filter(l => l.status === "failed").length;
        if (failedCount > 10) setSystemHealth("critical");
        else if (failedCount > 3) setSystemHealth("warning");
        else setSystemHealth("healthy");
      }
    } catch (error) {
      console.error("Error checking system health:", error);
    }
  };

  const handleTabChange = (tab: string) => {
    const targetTab = WORKSPACE_TABS.find(t => t.id === tab);
    if (targetTab) {
      navigate(targetTab.basePath);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkSystemHealth();
    // Trigger a global refresh event that child components can listen to
    window.dispatchEvent(new CustomEvent("workspace-refresh"));
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getHealthColor = () => {
    switch (systemHealth) {
      case "healthy": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "critical": return "bg-red-500";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold">CEO-in-a-Box</span>
            </div>
          </div>

          {/* Center: Workspace Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="hidden md:block">
            <TabsList className="grid grid-cols-2 w-[400px]">
              {WORKSPACE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-2">
            {/* System Health Indicator */}
            <Badge
              variant="outline"
              className="hidden sm:flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/app/command-center/system-health")}
            >
              <span className={`h-2 w-2 rounded-full ${getHealthColor()}`} />
              <Activity className="h-3 w-3" />
              <span className="text-xs capitalize">{systemHealth}</span>
            </Badge>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/app/command-center/settings")}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Tab Selector */}
        <div className="md:hidden border-t px-4 py-2">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid grid-cols-2 w-full">
              {WORKSPACE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
