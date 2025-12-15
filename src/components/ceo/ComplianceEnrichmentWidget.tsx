import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Zap,
  Users,
  Mail,
  Target,
} from "lucide-react";

interface ComplianceHealth {
  health_score: number;
  passed_checks: number;
  blocked_actions: number;
}

interface SegmentCounts {
  hot_lead: number;
  marketing_nurture: number;
  cold_outreach: number;
  compliance_hold: number;
}

const ComplianceEnrichmentWidget = () => {
  const [health, setHealth] = useState<ComplianceHealth | null>(null);
  const [segments, setSegments] = useState<SegmentCounts>({
    hot_lead: 0,
    marketing_nurture: 0,
    cold_outreach: 0,
    compliance_hold: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [healthRes, profilesRes] = await Promise.all([
        supabase
          .from("compliance_health")
          .select("*")
          .order("date", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("lead_enrichment_profiles")
          .select("segment"),
      ]);

      if (healthRes.data) {
        setHealth(healthRes.data);
      } else {
        setHealth({ health_score: 100, passed_checks: 0, blocked_actions: 0 });
      }

      const profiles = profilesRes.data || [];
      const counts: SegmentCounts = {
        hot_lead: 0,
        marketing_nurture: 0,
        cold_outreach: 0,
        compliance_hold: 0,
      };

      profiles.forEach((p) => {
        const seg = p.segment as keyof SegmentCounts;
        if (seg && counts[seg] !== undefined) {
          counts[seg]++;
        }
      });

      setSegments(counts);
    } catch (error) {
      console.error("Error fetching widget data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthIcon = (score: number) => {
    if (score >= 90) return <ShieldCheck className="h-5 w-5 text-green-500" />;
    if (score >= 70) return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
    return <ShieldX className="h-5 w-5 text-red-500" />;
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Compliance Health */}
      <div className="flex items-center gap-3">
        {health && getHealthIcon(health.health_score)}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Compliance Health
            </span>
            <span className={`text-sm font-bold ${getHealthColor(health?.health_score || 100)}`}>
              {health?.health_score || 100}%
            </span>
          </div>
          <Progress value={health?.health_score || 100} className="h-1.5" />
        </div>
      </div>

      {/* Segment Distribution */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Lead Segments</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 bg-orange-500/10 rounded">
            <Zap className="h-3 w-3 text-orange-500" />
            <span className="text-xs">Hot</span>
            <Badge variant="secondary" className="ml-auto text-xs">{segments.hot_lead}</Badge>
          </div>
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded">
            <Mail className="h-3 w-3 text-blue-500" />
            <span className="text-xs">Nurture</span>
            <Badge variant="secondary" className="ml-auto text-xs">{segments.marketing_nurture}</Badge>
          </div>
          <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded">
            <Target className="h-3 w-3 text-purple-500" />
            <span className="text-xs">Cold</span>
            <Badge variant="secondary" className="ml-auto text-xs">{segments.cold_outreach}</Badge>
          </div>
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded">
            <Shield className="h-3 w-3 text-red-500" />
            <span className="text-xs">Hold</span>
            <Badge variant="secondary" className="ml-auto text-xs">{segments.compliance_hold}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceEnrichmentWidget;
