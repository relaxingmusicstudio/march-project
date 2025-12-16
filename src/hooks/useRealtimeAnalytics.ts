import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RealtimeMetrics {
  activeVisitors: number;
  todaysLeads: number;
  hotLeads: number;
  conversionRate: number;
  pipelineValue: number;
  pendingApprovals: number;
  totalVisitors: number;
  conversions: number;
}

interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
}

interface EngagementData {
  hour: number;
  day: string;
  count: number;
}

interface TrafficSource {
  source: string;
  leads: number;
  conversions: number;
  revenue: number;
}

export function useRealtimeAnalytics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    activeVisitors: 0,
    todaysLeads: 0,
    hotLeads: 0,
    conversionRate: 0,
    pipelineValue: 0,
    pendingApprovals: 0,
    totalVisitors: 0,
    conversions: 0,
  });
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [leadsRes, pipelineRes, contentRes, analyticsRes, visitorsRes] = await Promise.all([
        supabase.from("leads").select("*").gte("created_at", today.toISOString()),
        supabase.from("deal_pipeline").select("*"),
        supabase.from("content").select("*").eq("status", "pending"),
        supabase.from("analytics_events").select("*").gte("created_at", weekAgo.toISOString()),
        supabase.from("visitors").select("*").gte("last_seen_at", fiveMinAgo.toISOString()),
      ]);

      const leads = leadsRes.data || [];
      const pipeline = pipelineRes.data || [];
      const content = contentRes.data || [];
      const analytics = analyticsRes.data || [];
      const activeVisitors = visitorsRes.data || [];

      const hotLeads = leads.filter(l => l.lead_score >= 70 || l.lead_temperature === "hot");
      const conversions = leads.filter(l => l.status === "won" || l.status === "converted");
      const pipelineValue = pipeline.reduce((sum, d) => sum + (d.value || 0), 0);

      setMetrics({
        activeVisitors: activeVisitors.length,
        todaysLeads: leads.length,
        hotLeads: hotLeads.length,
        conversionRate: leads.length > 0 ? (conversions.length / leads.length) * 100 : 0,
        pipelineValue,
        pendingApprovals: content.length,
        totalVisitors: analytics.filter(e => e.event_type === "page_view").length,
        conversions: conversions.length,
      });

      // Build funnel data
      const totalVisitors = analytics.filter(e => e.event_type === "page_view").length || 1;
      const engaged = analytics.filter(e => e.event_type === "click" || e.event_type === "scroll").length;
      const leadsCount = leads.length;
      const qualifiedLeads = hotLeads.length;
      const converted = conversions.length;

      setFunnelData([
        { name: "Visitors", count: totalVisitors, percentage: 100, dropoff: 0 },
        { name: "Engaged", count: engaged, percentage: (engaged / totalVisitors) * 100, dropoff: 100 - (engaged / totalVisitors) * 100 },
        { name: "Leads", count: leadsCount, percentage: (leadsCount / totalVisitors) * 100, dropoff: engaged > 0 ? 100 - (leadsCount / engaged) * 100 : 0 },
        { name: "Qualified", count: qualifiedLeads, percentage: (qualifiedLeads / totalVisitors) * 100, dropoff: leadsCount > 0 ? 100 - (qualifiedLeads / leadsCount) * 100 : 0 },
        { name: "Converted", count: converted, percentage: (converted / totalVisitors) * 100, dropoff: qualifiedLeads > 0 ? 100 - (converted / qualifiedLeads) * 100 : 0 },
      ]);

      // Build engagement heat map data
      const engagementMap: Record<string, number> = {};
      analytics.forEach(event => {
        const date = new Date(event.created_at || "");
        const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
        const hour = date.getHours();
        const key = `${day}-${hour}`;
        engagementMap[key] = (engagementMap[key] || 0) + 1;
      });

      const engagementArr: EngagementData[] = [];
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
        for (let hour = 0; hour < 24; hour++) {
          engagementArr.push({
            day,
            hour,
            count: engagementMap[`${day}-${hour}`] || 0,
          });
        }
      });
      setEngagementData(engagementArr);

      // Build traffic sources
      const sourceMap: Record<string, { leads: number; conversions: number; revenue: number }> = {};
      leads.forEach(lead => {
        const source = lead.source || "Direct";
        if (!sourceMap[source]) {
          sourceMap[source] = { leads: 0, conversions: 0, revenue: 0 };
        }
        sourceMap[source].leads++;
        if (lead.status === "won" || lead.status === "converted") {
          sourceMap[source].conversions++;
          sourceMap[source].revenue += lead.revenue_value || 0;
        }
      });

      setTrafficSources(
        Object.entries(sourceMap).map(([source, data]) => ({
          source,
          ...data,
        }))
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Set up real-time subscriptions
    const channel = supabase
      .channel("analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "analytics_events" }, () => fetchMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => fetchMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_pipeline" }, () => fetchMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "content" }, () => fetchMetrics())
      .subscribe();

    // Refresh every 30 seconds as backup
    const interval = setInterval(fetchMetrics, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchMetrics]);

  return {
    metrics,
    funnelData,
    engagementData,
    trafficSources,
    isLoading,
    lastUpdated,
    refresh: fetchMetrics,
  };
}
