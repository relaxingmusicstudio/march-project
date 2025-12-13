import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, AlertTriangle, TrendingDown, TrendingUp, Users } from "lucide-react";

interface Client {
  id: string;
  name: string;
  healthScore: number;
  mrr: number;
  status: string;
  trend?: "up" | "down" | "stable";
}

interface ClientHealthWidgetProps {
  clients: Client[];
  className?: string;
}

const ClientHealthWidget = ({ clients, className = "" }: ClientHealthWidgetProps) => {
  const activeClients = clients.filter(c => c.status === "active");
  const atRisk = activeClients.filter(c => c.healthScore < 50);
  const healthy = activeClients.filter(c => c.healthScore >= 70);
  const avgHealth = activeClients.length > 0 
    ? Math.round(activeClients.reduce((sum, c) => sum + c.healthScore, 0) / activeClients.length)
    : 0;

  const getHealthColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getHealthBg = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Client Health
          </div>
          <Badge variant="outline" className="text-xs">
            {activeClients.length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Overview */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <p className="text-lg font-bold text-green-500">{healthy.length}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <p className="text-lg font-bold text-yellow-500">{activeClients.length - healthy.length - atRisk.length}</p>
            <p className="text-xs text-muted-foreground">Monitor</p>
          </div>
          <div className="p-2 bg-red-500/10 rounded-lg">
            <p className="text-lg font-bold text-red-500">{atRisk.length}</p>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </div>
        </div>

        {/* Average Health Score */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg Health Score</span>
            <span className={`font-medium ${getHealthColor(avgHealth)}`}>{avgHealth}/100</span>
          </div>
          <Progress value={avgHealth} className="h-2" />
        </div>

        {/* At-Risk Clients */}
        {atRisk.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium text-red-500">
              <AlertTriangle className="h-3 w-3" />
              At-Risk Clients
            </div>
            <ScrollArea className="h-24">
              <div className="space-y-2">
                {atRisk.slice(0, 5).map((client) => (
                  <div 
                    key={client.id} 
                    className="flex items-center justify-between p-2 bg-red-500/5 rounded-lg border border-red-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getHealthBg(client.healthScore)}`} />
                      <div>
                        <p className="text-sm font-medium truncate max-w-[120px]">{client.name}</p>
                        <p className="text-xs text-muted-foreground">${client.mrr.toLocaleString()}/mo</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-medium ${getHealthColor(client.healthScore)}`}>
                        {client.healthScore}
                      </span>
                      {client.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                      {client.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {atRisk.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">All clients are healthy!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientHealthWidget;
