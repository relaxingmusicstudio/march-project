import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  MessageSquare, 
  Phone,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  BarChart3,
  Target,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DailyMetrics {
  totalLeads: number;
  newLeadsToday: number;
  totalRevenue: number;
  revenueToday: number;
  conversions: number;
  conversionRate: number;
  totalVisitors: number;
  visitorsToday: number;
  conversations: number;
  conversationsToday: number;
  hotLeads: number;
  avgLeadScore: number;
}

const CEOConsole = () => {
  const [metrics, setMetrics] = useState<DailyMetrics>({
    totalLeads: 0,
    newLeadsToday: 0,
    totalRevenue: 0,
    revenueToday: 0,
    conversions: 0,
    conversionRate: 0,
    totalVisitors: 0,
    visitorsToday: 0,
    conversations: 0,
    conversationsToday: 0,
    hotLeads: 0,
    avgLeadScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    try {
      // Fetch all leads
      const { data: leads } = await supabase.from("leads").select("*");
      const allLeads = leads || [];
      const todayLeads = allLeads.filter(l => new Date(l.created_at || "") >= today);
      const hotLeads = allLeads.filter(l => l.lead_temperature === "hot" || (l.lead_score && l.lead_score >= 70));
      const conversions = allLeads.filter(l => l.status === "converted");
      const totalRevenue = allLeads.reduce((sum, l) => sum + (l.revenue_value || 0), 0);
      const todayRevenue = todayLeads.reduce((sum, l) => sum + (l.revenue_value || 0), 0);
      const avgScore = allLeads.length > 0 
        ? Math.round(allLeads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / allLeads.length)
        : 0;

      // Fetch visitors
      const { data: visitors } = await supabase.from("visitors").select("*");
      const allVisitors = visitors || [];
      const todayVisitors = allVisitors.filter(v => new Date(v.created_at || "") >= today);

      // Fetch conversations
      const { data: convos } = await supabase.from("conversations").select("*");
      const allConvos = convos || [];
      const todayConvos = allConvos.filter(c => new Date(c.created_at || "") >= today);

      setMetrics({
        totalLeads: allLeads.length,
        newLeadsToday: todayLeads.length,
        totalRevenue,
        revenueToday: todayRevenue,
        conversions: conversions.length,
        conversionRate: allLeads.length > 0 ? Math.round((conversions.length / allLeads.length) * 100) : 0,
        totalVisitors: allVisitors.length,
        visitorsToday: todayVisitors.length,
        conversations: allConvos.length,
        conversationsToday: todayConvos.length,
        hotLeads: hotLeads.length,
        avgLeadScore: avgScore,
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const MetricCard = ({ 
    title, 
    value, 
    subValue, 
    subLabel, 
    icon: Icon, 
    trend,
    accent = false 
  }: { 
    title: string; 
    value: string | number; 
    subValue?: string | number;
    subLabel?: string;
    icon: any; 
    trend?: "up" | "down";
    accent?: boolean;
  }) => (
    <Card className={`relative overflow-hidden transition-all duration-300 hover:card-shadow-hover ${accent ? 'border-accent/50 bg-gradient-to-br from-accent/5 to-accent/10' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${accent ? 'bg-accent/20 text-accent' : 'bg-secondary text-primary'}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {subValue !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <ArrowUpRight className="h-3 w-3 text-green-500" />}
            {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={`text-sm ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
              {subValue} {subLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CEO Console</h1>
          <p className="text-muted-foreground mt-1">
            Daily overview • Last updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            size="sm"
            onClick={() => navigate("/admin/analytics")}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Full Analytics
          </Button>
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-accent" />
          Financials
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Total Revenue" 
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            subValue={`+$${metrics.revenueToday.toLocaleString()}`}
            subLabel="today"
            icon={DollarSign}
            trend={metrics.revenueToday > 0 ? "up" : undefined}
            accent
          />
          <MetricCard 
            title="Conversions" 
            value={metrics.conversions}
            subValue={`${metrics.conversionRate}%`}
            subLabel="rate"
            icon={Target}
            trend={metrics.conversionRate > 10 ? "up" : "down"}
          />
          <MetricCard 
            title="Hot Leads" 
            value={metrics.hotLeads}
            subValue="High intent"
            icon={Zap}
            accent
          />
          <MetricCard 
            title="Avg Lead Score" 
            value={metrics.avgLeadScore}
            subValue="/ 100"
            icon={TrendingUp}
            trend={metrics.avgLeadScore > 50 ? "up" : "down"}
          />
        </div>
      </div>

      {/* Lead & Traffic Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Leads & Traffic
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Total Leads" 
            value={metrics.totalLeads}
            subValue={`+${metrics.newLeadsToday}`}
            subLabel="today"
            icon={Users}
            trend={metrics.newLeadsToday > 0 ? "up" : undefined}
          />
          <MetricCard 
            title="New Today" 
            value={metrics.newLeadsToday}
            icon={Calendar}
          />
          <MetricCard 
            title="Total Visitors" 
            value={metrics.totalVisitors.toLocaleString()}
            subValue={`+${metrics.visitorsToday}`}
            subLabel="today"
            icon={TrendingUp}
            trend={metrics.visitorsToday > 0 ? "up" : undefined}
          />
          <MetricCard 
            title="Visitors Today" 
            value={metrics.visitorsToday}
            icon={Users}
          />
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Engagement
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Total Conversations" 
            value={metrics.conversations}
            subValue={`+${metrics.conversationsToday}`}
            subLabel="today"
            icon={MessageSquare}
            trend={metrics.conversationsToday > 0 ? "up" : undefined}
          />
          <MetricCard 
            title="Today's Conversations" 
            value={metrics.conversationsToday}
            icon={Phone}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/analytics")}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-sm">Analytics</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/inbox")}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-sm">Inbox</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/contacts")}
          >
            <Users className="h-5 w-5" />
            <span className="text-sm">Contacts</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/sequences")}
          >
            <Zap className="h-5 w-5" />
            <span className="text-sm">Sequences</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CEOConsole;
