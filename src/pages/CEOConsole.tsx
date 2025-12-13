import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  RefreshCw,
  BarChart3,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import CEOChatPanel from "@/components/CEOChatPanel";
import ChannelPerformanceTable from "@/components/ChannelPerformanceTable";
import ABTestsWidget from "@/components/ABTestsWidget";
import AdminLayout from "@/components/AdminLayout";

interface Metrics {
  totalRevenue: number;
  revenueToday: number;
  totalLeads: number;
  leadsToday: number;
  totalVisitors: number;
  visitorsToday: number;
  conversions: number;
  conversionRate: number;
  visitorToLeadRate: number;
  leadToCustomerRate: number;
  hotLeads: number;
  avgLeadScore: number;
}

interface ChannelData {
  source: string;
  visitors: number;
  leads: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

interface ABTest {
  id: string;
  name: string;
  elementType: string;
  status: string;
  variants: {
    id: string;
    name: string;
    value: string;
    views: number;
    conversions: number;
    conversionRate: number;
  }[];
}

const CEOConsole = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    totalRevenue: 0,
    revenueToday: 0,
    totalLeads: 0,
    leadsToday: 0,
    totalVisitors: 0,
    visitorsToday: 0,
    conversions: 0,
    conversionRate: 0,
    visitorToLeadRate: 0,
    leadToCustomerRate: 0,
    hotLeads: 0,
    avgLeadScore: 0,
  });
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const [visitorsRes, leadsRes, experimentsRes, variantsRes] = await Promise.all([
        supabase.from("visitors").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("ab_test_experiments").select("*").in("status", ["active", "completed"]),
        supabase.from("ab_test_variants").select("*"),
      ]);

      const visitors = visitorsRes.data || [];
      const leads = leadsRes.data || [];
      const experiments = experimentsRes.data || [];
      const variants = variantsRes.data || [];

      const todayLeads = leads.filter(l => new Date(l.created_at || "") >= today);
      const todayVisitors = visitors.filter(v => new Date(v.created_at || "") >= today);
      const conversions = leads.filter(l => l.status === "converted" || l.status === "won");
      const hotLeads = leads.filter(l => l.lead_temperature === "hot" || (l.lead_score && l.lead_score >= 70));
      const totalRevenue = leads.reduce((sum, l) => sum + (l.revenue_value || 0), 0);
      const todayRevenue = todayLeads.reduce((sum, l) => sum + (l.revenue_value || 0), 0);
      const avgScore = leads.length > 0 
        ? Math.round(leads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / leads.length)
        : 0;

      const visitorToLeadRate = visitors.length > 0 ? (leads.length / visitors.length) * 100 : 0;
      const leadToCustomerRate = leads.length > 0 ? (conversions.length / leads.length) * 100 : 0;
      const overallConversionRate = visitors.length > 0 ? (conversions.length / visitors.length) * 100 : 0;

      setMetrics({
        totalRevenue,
        revenueToday: todayRevenue,
        totalLeads: leads.length,
        leadsToday: todayLeads.length,
        totalVisitors: visitors.length,
        visitorsToday: todayVisitors.length,
        conversions: conversions.length,
        conversionRate: overallConversionRate,
        visitorToLeadRate,
        leadToCustomerRate,
        hotLeads: hotLeads.length,
        avgLeadScore: avgScore,
      });

      const sourceMap: Record<string, { visitors: number; leads: number; conversions: number; revenue: number }> = {};
      
      visitors.forEach((v: any) => {
        const source = v.utm_source || "Direct";
        if (!sourceMap[source]) {
          sourceMap[source] = { visitors: 0, leads: 0, conversions: 0, revenue: 0 };
        }
        sourceMap[source].visitors++;
      });

      leads.forEach((l: any) => {
        const visitor = visitors.find((v: any) => v.visitor_id === l.visitor_id);
        const source = visitor?.utm_source || "Direct";
        if (!sourceMap[source]) {
          sourceMap[source] = { visitors: 0, leads: 0, conversions: 0, revenue: 0 };
        }
        sourceMap[source].leads++;
        if (l.status === "converted" || l.status === "won") {
          sourceMap[source].conversions++;
          sourceMap[source].revenue += l.revenue_value || 0;
        }
      });

      const channels: ChannelData[] = Object.entries(sourceMap)
        .map(([source, data]) => ({
          source,
          ...data,
          conversionRate: data.leads > 0 ? (data.conversions / data.leads) * 100 : 0,
        }))
        .sort((a, b) => b.visitors - a.visitors);

      setChannelData(channels);

      const tests: ABTest[] = experiments.map((exp: any) => {
        const expVariants = variants
          .filter((v: any) => v.experiment_id === exp.id)
          .map((v: any) => ({
            id: v.id,
            name: v.name,
            value: v.value,
            views: v.views || 0,
            conversions: v.conversions || 0,
            conversionRate: v.views > 0 ? ((v.conversions || 0) / v.views) * 100 : 0,
          }));

        return {
          id: exp.id,
          name: exp.name,
          elementType: exp.element_type,
          status: exp.status,
          variants: expVariants,
        };
      });

      setABTests(tests);
    } catch (error) {
      console.error("Error fetching CEO data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
    <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${accent ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <div className={`p-1.5 rounded-md ${accent ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subValue !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <ArrowUpRight className="h-3 w-3 text-green-500" />}
            {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={`text-xs ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
              {subValue} {subLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout 
      title="CEO Dashboard" 
      subtitle="Executive overview • Real-time business intelligence"
    >
      {/* Top Actions Bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData}
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
          Deep Dive
        </Button>
      </div>

      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
          title="Conversion Rate" 
          value={`${metrics.conversionRate.toFixed(1)}%`}
          subValue={`${metrics.conversions} sales`}
          icon={Target}
          trend={metrics.conversionRate > 5 ? "up" : "down"}
        />
        <MetricCard 
          title="Hot Leads" 
          value={metrics.hotLeads}
          subValue="Ready to close"
          icon={Zap}
        />
        <MetricCard 
          title="Avg Lead Score" 
          value={metrics.avgLeadScore}
          subValue="/ 100"
          icon={TrendingUp}
          trend={metrics.avgLeadScore > 50 ? "up" : "down"}
        />
      </div>

      {/* Row 2: Conversion Funnel */}
      <Card className="mb-4">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{metrics.totalVisitors.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Visitors</p>
            </div>
            <div className="flex flex-col items-center">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground rotate-45" />
              <Badge variant="outline" className="text-xs mt-1">
                {metrics.visitorToLeadRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex-1 text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{metrics.totalLeads}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
            <div className="flex flex-col items-center">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground rotate-45" />
              <Badge variant="outline" className="text-xs mt-1">
                {metrics.leadToCustomerRate.toFixed(1)}%
              </Badge>
            </div>
            <div className="flex-1 text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-2xl font-bold text-primary">{metrics.conversions}</p>
              <p className="text-xs text-muted-foreground">Customers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Split View - Channel Performance + AI Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Channel Performance (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Channel Performance
                <Badge variant="secondary" className="text-xs ml-auto">
                  {channelData.length} sources
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ChannelPerformanceTable data={channelData} isLoading={loading} />
            </CardContent>
          </Card>

          <ABTestsWidget 
            tests={abTests} 
            onRefresh={fetchData}
            isLoading={loading}
          />
        </div>

        {/* Right: AI Chat + Quick Actions (40%) */}
        <div className="lg:col-span-2 space-y-4">
          <CEOChatPanel className="h-[420px]" />
          
          {/* Quick Actions */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0">
              <Button 
                variant="outline" 
                size="sm"
                className="justify-start"
                onClick={() => navigate("/admin/agent/funnels")}
              >
                <Target className="h-4 w-4 mr-2" />
                Funnels
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="justify-start"
                onClick={() => navigate("/admin/contacts")}
              >
                <Users className="h-4 w-4 mr-2" />
                Leads
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="justify-start"
                onClick={() => navigate("/admin/agent/content")}
              >
                <Zap className="h-4 w-4 mr-2" />
                Content
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="justify-start"
                onClick={() => navigate("/admin/agent/ads")}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Ads
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default CEOConsole;
