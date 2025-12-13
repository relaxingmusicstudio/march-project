import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Anomaly {
  id: string;
  type: "spike" | "drop" | "unusual";
  metric: string;
  value: number;
  expected: number;
  change: number;
  severity: "high" | "medium" | "low";
  timestamp: Date;
}

interface AnomalyAlertsProps {
  data: {
    visitors: { date: string; count: number }[];
    leads: { date: string; count: number }[];
    revenue: { date: string; amount: number }[];
    conversions: { date: string; count: number }[];
  };
  onDismiss?: (id: string) => void;
  className?: string;
}

const AnomalyAlerts = ({ data, onDismiss, className = "" }: AnomalyAlertsProps) => {
  const anomalies = useMemo(() => {
    const detected: Anomaly[] = [];

    const detectAnomalies = (
      values: number[],
      metricName: string,
      isMonetary = false
    ) => {
      if (values.length < 7) return;

      const recent = values.slice(-7);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const stdDev = Math.sqrt(
        recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length
      );

      const latest = values[values.length - 1];
      const yesterday = values[values.length - 2] || avg;
      const zScore = stdDev > 0 ? (latest - avg) / stdDev : 0;

      // Spike detection (>2 standard deviations above)
      if (zScore > 2) {
        const changePercent = ((latest - avg) / avg) * 100;
        detected.push({
          id: `spike-${metricName}`,
          type: "spike",
          metric: metricName,
          value: latest,
          expected: avg,
          change: changePercent,
          severity: zScore > 3 ? "high" : "medium",
          timestamp: new Date(),
        });
      }

      // Drop detection (>2 standard deviations below)
      if (zScore < -2 && avg > 0) {
        const changePercent = ((avg - latest) / avg) * 100;
        detected.push({
          id: `drop-${metricName}`,
          type: "drop",
          metric: metricName,
          value: latest,
          expected: avg,
          change: -changePercent,
          severity: zScore < -3 ? "high" : "medium",
          timestamp: new Date(),
        });
      }

      // Sudden change from yesterday (>50%)
      if (yesterday > 0) {
        const dayChange = ((latest - yesterday) / yesterday) * 100;
        if (Math.abs(dayChange) > 50 && !detected.find(d => d.metric === metricName)) {
          detected.push({
            id: `change-${metricName}`,
            type: dayChange > 0 ? "spike" : "drop",
            metric: metricName,
            value: latest,
            expected: yesterday,
            change: dayChange,
            severity: Math.abs(dayChange) > 100 ? "high" : "low",
            timestamp: new Date(),
          });
        }
      }
    };

    // Analyze each metric
    if (data.visitors.length > 0) {
      detectAnomalies(data.visitors.map(v => v.count), "Visitors");
    }
    if (data.leads.length > 0) {
      detectAnomalies(data.leads.map(l => l.count), "Leads");
    }
    if (data.revenue.length > 0) {
      detectAnomalies(data.revenue.map(r => r.amount), "Revenue", true);
    }
    if (data.conversions.length > 0) {
      detectAnomalies(data.conversions.map(c => c.count), "Conversions");
    }

    return detected.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [data]);

  const getSeverityStyles = (severity: Anomaly["severity"]) => {
    switch (severity) {
      case "high":
        return "bg-red-500/10 border-red-500/30 text-red-600";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-600";
      case "low":
        return "bg-blue-500/10 border-blue-500/30 text-blue-600";
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Anomaly Detection
          </div>
          {anomalies.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {anomalies.length} alert{anomalies.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {anomalies.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No anomalies detected</p>
            <p className="text-xs">All metrics within normal range</p>
          </div>
        ) : (
          anomalies.slice(0, 5).map((anomaly) => (
            <div
              key={anomaly.id}
              className={`p-3 rounded-lg border flex items-start justify-between gap-2 ${getSeverityStyles(anomaly.severity)}`}
            >
              <div className="flex items-start gap-2">
                {anomaly.type === "spike" ? (
                  <TrendingUp className="h-4 w-4 mt-0.5" />
                ) : (
                  <TrendingDown className="h-4 w-4 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {anomaly.metric} {anomaly.type === "spike" ? "Spike" : "Drop"}
                  </p>
                  <p className="text-xs opacity-80">
                    {anomaly.change > 0 ? "+" : ""}{anomaly.change.toFixed(0)}% from expected
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    Current: {anomaly.value.toLocaleString()} | Expected: ~{Math.round(anomaly.expected).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-60 hover:opacity-100"
                  onClick={() => onDismiss(anomaly.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default AnomalyAlerts;
