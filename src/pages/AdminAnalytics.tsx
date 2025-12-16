import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, BarChart3, Filter, Flame, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useRealtimeAnalytics } from "@/hooks/useRealtimeAnalytics";
import { LiveMetricsCard } from "@/components/analytics/LiveMetricsCard";
import { ConversionFunnel } from "@/components/analytics/ConversionFunnel";
import { EngagementHeatMap } from "@/components/analytics/EngagementHeatMap";
import { ConversionInsightsPanel } from "@/components/analytics/ConversionInsightsPanel";
import { UnifiedDashboard } from "@/components/analytics/UnifiedDashboard";
import { Users, Target, DollarSign, Zap, TrendingUp, Clock } from "lucide-react";

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { metrics, funnelData, engagementData, isLoading, lastUpdated, refresh } = useRealtimeAnalytics();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/ceo")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to CEO
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
                <Brain className="w-7 h-7 text-primary" />
                Analytics Deep Dive
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Real-time business intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Updated {lastUpdated.toLocaleTimeString()}
            </Badge>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <LiveMetricsCard
            title="Active Visitors"
            value={metrics.activeVisitors}
            icon={Users}
            isLive
            entity="crm"
          />
          <LiveMetricsCard
            title="Today's Leads"
            value={metrics.todaysLeads}
            icon={Target}
            isLive
            entity="crm"
            filter={{ filter: "all" }}
          />
          <LiveMetricsCard
            title="Hot Leads"
            value={metrics.hotLeads}
            icon={Zap}
            isLive
            entity="crm"
            filter={{ filter: "hot" }}
          />
          <LiveMetricsCard
            title="Conversion Rate"
            value={metrics.conversionRate}
            format="percentage"
            icon={TrendingUp}
            entity="pipeline"
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="funnel" className="gap-2">
              <Filter className="h-4 w-4" /> Funnel
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-2">
              <Flame className="h-4 w-4" /> Heat Map
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Sparkles className="h-4 w-4" /> AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <UnifiedDashboard />
          </TabsContent>

          <TabsContent value="funnel">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversionFunnel data={funnelData} isLoading={isLoading} />
              <ConversionInsightsPanel />
            </div>
          </TabsContent>

          <TabsContent value="heatmap">
            <EngagementHeatMap data={engagementData} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="insights">
            <ConversionInsightsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAnalytics;
