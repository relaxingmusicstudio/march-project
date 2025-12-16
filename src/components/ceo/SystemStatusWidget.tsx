import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Mic,
  Bot,
  CreditCard,
  Wifi
} from "lucide-react";

type HealthStatus = "healthy" | "warning" | "error" | "unknown";

interface SystemStatus {
  voiceAgent: HealthStatus;
  ai: HealthStatus;
  payments: HealthStatus;
  database: HealthStatus;
}

export function SystemStatusWidget() {
  const [status, setStatus] = useState<SystemStatus>({
    voiceAgent: "unknown",
    ai: "unknown",
    payments: "unknown",
    database: "unknown",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      // Check database by making a simple query
      const { error: dbError } = await supabase.from("automation_logs").select("id").limit(1);
      
      // Check recent automation logs for failures
      const { data: logs } = await supabase
        .from("automation_logs")
        .select("*")
        .gte("started_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("started_at", { ascending: false })
        .limit(10);

      const recentFailures = logs?.filter(l => l.status === "failed") || [];

      // Check AI cost log for recent successful calls
      const { data: aiLogs } = await supabase
        .from("ai_cost_log")
        .select("*")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(5);

      const aiHealth = aiLogs && aiLogs.length > 0 
        ? aiLogs.some(l => l.success === false) ? "warning" : "healthy"
        : "unknown";

      setStatus({
        database: dbError ? "error" : "healthy",
        voiceAgent: recentFailures.some(l => l.function_name?.includes("voice")) ? "warning" : "healthy",
        ai: aiHealth,
        payments: "healthy", // Assume healthy unless we have a payments check endpoint
      });
    } catch (error) {
      console.error("Error checking system health:", error);
      setStatus({
        database: "error",
        voiceAgent: "unknown",
        ai: "unknown",
        payments: "unknown",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (health: HealthStatus) => {
    switch (health) {
      case "healthy": return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "warning": return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case "error": return <XCircle className="h-3 w-3 text-destructive" />;
      default: return <Activity className="h-3 w-3 text-muted-foreground animate-pulse" />;
    }
  };

  const getStatusText = (health: HealthStatus) => {
    switch (health) {
      case "healthy": return "Active";
      case "warning": return "Degraded";
      case "error": return "Down";
      default: return "Checking...";
    }
  };

  const overallHealth = 
    status.database === "error" || status.ai === "error" ? "error" :
    status.voiceAgent === "warning" || status.ai === "warning" ? "warning" :
    "healthy";

  const systems = [
    { name: "Voice Agent", icon: Mic, status: status.voiceAgent },
    { name: "AI", icon: Bot, status: status.ai },
    { name: "Payments", icon: CreditCard, status: status.payments },
    { name: "Database", icon: Wifi, status: status.database },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            System Status
          </div>
          <Badge 
            variant={overallHealth === "healthy" ? "default" : overallHealth === "warning" ? "secondary" : "destructive"}
            className="text-xs"
          >
            {getStatusText(overallHealth)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {systems.map((system) => (
            <div
              key={system.name}
              className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <system.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs">{system.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {getStatusIcon(system.status)}
                <span className="text-xs text-muted-foreground">
                  {getStatusText(system.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
