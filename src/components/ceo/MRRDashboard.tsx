import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Users, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Client {
  id: string;
  name: string;
  mrr: number;
  status: string;
  startDate: string;
  plan: string;
}

interface MRRDashboardProps {
  clients: Client[];
  className?: string;
}

const MRRDashboard = ({ clients, className = "" }: MRRDashboardProps) => {
  const metrics = useMemo(() => {
    const active = clients.filter(c => c.status === "active");
    const churned = clients.filter(c => c.status === "churned");
    
    const currentMRR = active.reduce((sum, c) => sum + c.mrr, 0);
    const arr = currentMRR * 12;
    
    // Calculate MRR by plan
    const byPlan: Record<string, number> = {};
    active.forEach(c => {
      byPlan[c.plan] = (byPlan[c.plan] || 0) + c.mrr;
    });

    // Simulate historical MRR (last 6 months)
    const history = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const monthClients = clients.filter(c => {
        const start = new Date(c.startDate);
        return start <= date && (c.status === "active" || (c.status === "churned" && new Date(c.startDate) > date));
      });
      const monthMRR = monthClients.reduce((sum, c) => sum + c.mrr, 0);
      history.push({
        month: date.toLocaleDateString("en-US", { month: "short" }),
        mrr: monthMRR,
      });
    }

    // Growth rate
    const lastMonth = history[history.length - 2]?.mrr || 0;
    const growthRate = lastMonth > 0 ? ((currentMRR - lastMonth) / lastMonth) * 100 : 0;

    // Average Revenue Per User
    const arpu = active.length > 0 ? currentMRR / active.length : 0;

    // Churned MRR
    const churnedMRR = churned.reduce((sum, c) => sum + c.mrr, 0);

    return {
      currentMRR,
      arr,
      activeCount: active.length,
      byPlan,
      history,
      growthRate,
      arpu,
      churnedMRR,
    };
  }, [clients]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            MRR Dashboard
          </div>
          <Badge 
            variant={metrics.growthRate >= 0 ? "default" : "destructive"} 
            className="text-xs"
          >
            {metrics.growthRate >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(metrics.growthRate).toFixed(1)}% MoM
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Monthly Revenue</p>
            <p className="text-2xl font-bold">${metrics.currentMRR.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Annual Revenue</p>
            <p className="text-2xl font-bold">${(metrics.arr / 1000).toFixed(0)}k</p>
          </div>
        </div>

        {/* MRR Chart */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.history}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, "MRR"]}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area 
                type="monotone" 
                dataKey="mrr" 
                stroke="hsl(var(--primary))" 
                fill="url(#mrrGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="font-medium">{metrics.activeCount}</p>
            <p className="text-muted-foreground">Clients</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="font-medium">${metrics.arpu.toFixed(0)}</p>
            <p className="text-muted-foreground">ARPU</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="font-medium text-red-500">-${metrics.churnedMRR.toLocaleString()}</p>
            <p className="text-muted-foreground">Churned</p>
          </div>
        </div>

        {/* By Plan */}
        {Object.keys(metrics.byPlan).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Revenue by Plan</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(metrics.byPlan)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, mrr]) => (
                  <Badge key={plan} variant="outline" className="text-xs">
                    {plan}: ${mrr.toLocaleString()}
                  </Badge>
                ))
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MRRDashboard;
