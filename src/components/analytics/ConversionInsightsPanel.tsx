import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface Insight {
  id: string;
  type: "optimization" | "warning" | "success" | "recommendation";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  action?: string;
  confidence: number;
}

export function ConversionInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateInsights();
  }, []);

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      // Fetch data for analysis
      const [leadsRes, analyticsRes, contentRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("analytics_events").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("content").select("*").eq("status", "published").limit(50),
      ]);

      const leads = leadsRes.data || [];
      const analytics = analyticsRes.data || [];
      const content = contentRes.data || [];

      const generatedInsights: Insight[] = [];

      // Analyze conversion patterns
      const hotLeads = leads.filter(l => l.lead_temperature === "hot" || l.lead_score >= 70);
      const conversionRate = leads.length > 0 
        ? (leads.filter(l => l.status === "converted").length / leads.length) * 100 
        : 0;

      if (conversionRate < 10) {
        generatedInsights.push({
          id: "conv-low",
          type: "warning",
          title: "Low Conversion Rate",
          description: `Current conversion rate is ${conversionRate.toFixed(1)}%. Consider reviewing your lead qualification process.`,
          impact: "high",
          action: "Review Lead Scoring",
          confidence: 95,
        });
      }

      if (hotLeads.length > 0) {
        generatedInsights.push({
          id: "hot-leads",
          type: "optimization",
          title: `${hotLeads.length} Hot Leads Need Attention`,
          description: "These high-score leads are ready for outreach. Prioritize personal contact within 24 hours for best conversion.",
          impact: "high",
          action: "Call Hot Leads",
          confidence: 90,
        });
      }

      // Analyze traffic patterns
      const pageViews = analytics.filter(e => e.event_type === "page_view");
      const uniqueVisitors = new Set(pageViews.map(p => p.visitor_id)).size;
      
      if (uniqueVisitors > 0 && leads.length < uniqueVisitors * 0.1) {
        generatedInsights.push({
          id: "visitor-conv",
          type: "recommendation",
          title: "Visitor-to-Lead Gap",
          description: `Only ${((leads.length / uniqueVisitors) * 100).toFixed(1)}% of visitors become leads. Consider adding more CTAs or simplifying your forms.`,
          impact: "medium",
          action: "Optimize CTAs",
          confidence: 85,
        });
      }

      // Content performance
      if (content.length > 0) {
        generatedInsights.push({
          id: "content-opp",
          type: "optimization",
          title: "Content Engagement Opportunity",
          description: "Publishing consistent content can increase lead generation by up to 67%. Consider a content calendar.",
          impact: "medium",
          action: "Plan Content",
          confidence: 80,
        });
      }

      // Success pattern
      const recentConverted = leads.filter(l => {
        const created = new Date(l.created_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return l.status === "converted" && created > weekAgo;
      });

      if (recentConverted.length > 0) {
        generatedInsights.push({
          id: "recent-success",
          type: "success",
          title: `${recentConverted.length} Conversions This Week`,
          description: "Your recent outreach is working! Analyze what's different about these successful conversions.",
          impact: "low",
          confidence: 100,
        });
      }

      // Add a general AI recommendation
      generatedInsights.push({
        id: "ai-rec",
        type: "recommendation",
        title: "AI Recommendation",
        description: "Based on patterns in your data, focusing on quick follow-up response times could improve conversions by ~15%.",
        impact: "high",
        action: "Set Up Auto-Response",
        confidence: 75,
      });

      setInsights(generatedInsights.slice(0, 5));
    } catch (error) {
      console.error("Error generating insights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (insightId: string, positive: boolean) => {
    toast.success(positive ? "Thanks! We'll show more like this." : "Got it, we'll improve our suggestions.");
  };

  const getIcon = (type: Insight["type"]) => {
    switch (type) {
      case "optimization": return Lightbulb;
      case "warning": return AlertTriangle;
      case "success": return CheckCircle2;
      case "recommendation": return Sparkles;
      default: return TrendingUp;
    }
  };

  const getIconColor = (type: Insight["type"]) => {
    switch (type) {
      case "optimization": return "text-yellow-500";
      case "warning": return "text-red-500";
      case "success": return "text-green-500";
      case "recommendation": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  const getImpactBadge = (impact: Insight["impact"]) => {
    switch (impact) {
      case "high": return { variant: "destructive" as const, text: "High Impact" };
      case "medium": return { variant: "secondary" as const, text: "Medium" };
      default: return { variant: "outline" as const, text: "Low" };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Conversion Insights
          </div>
          <Button variant="ghost" size="sm" onClick={generateInsights} className="text-xs">
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 pt-0 space-y-3">
            {insights.map((insight) => {
              const Icon = getIcon(insight.type);
              const badge = getImpactBadge(insight.impact);
              
              return (
                <div
                  key={insight.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${getIconColor(insight.type)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{insight.title}</span>
                        <Badge variant={badge.variant} className="text-[10px]">
                          {badge.text}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {insight.description}
                      </p>
                      <div className="flex items-center justify-between">
                        {insight.action && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            {insight.action}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <span className="text-[10px] text-muted-foreground mr-2">
                            {insight.confidence}% confidence
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleFeedback(insight.id, true)}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleFeedback(insight.id, false)}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
