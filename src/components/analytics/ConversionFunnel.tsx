import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useClickThrough } from "@/hooks/useClickThrough";
import { TrendingDown, ChevronRight, Filter } from "lucide-react";

interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
}

interface ConversionFunnelProps {
  data: FunnelStage[];
  isLoading?: boolean;
}

export function ConversionFunnel({ data, isLoading }: ConversionFunnelProps) {
  const { navigateToDetail } = useClickThrough();

  const getHealthColor = (dropoff: number) => {
    if (dropoff < 30) return "bg-green-500";
    if (dropoff < 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getWidthPercent = (percentage: number) => {
    return Math.max(percentage, 10); // Minimum 10% width for visibility
  };

  const handleStageClick = (stage: FunnelStage) => {
    // Navigate to filtered CRM view based on stage
    const filterMap: Record<string, { filter?: string; status?: string }> = {
      "Visitors": {},
      "Engaged": {},
      "Leads": { filter: "all" },
      "Qualified": { filter: "hot" },
      "Converted": { status: "converted" },
    };
    navigateToDetail("crm", filterMap[stage.name]);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-2" style={{ width: `${100 - i * 15}%` }} />
                <div className="h-8 bg-muted/50 rounded" style={{ width: `${100 - i * 15}%` }} />
              </div>
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
            <Filter className="h-4 w-4 text-primary" />
            Conversion Funnel
          </div>
          <Badge variant="secondary" className="text-xs">
            {data.length > 0 ? `${data[data.length - 1]?.percentage.toFixed(1)}% overall` : "0%"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((stage, index) => (
            <div
              key={stage.name}
              className="group cursor-pointer"
              onClick={() => handleStageClick(stage)}
            >
              {/* Stage header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{stage.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{stage.percentage.toFixed(1)}%</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Funnel bar */}
              <div className="relative h-10 flex items-center justify-center">
                <div
                  className={cn(
                    "h-full rounded-lg transition-all duration-300 group-hover:opacity-90",
                    "bg-primary/80"
                  )}
                  style={{ 
                    width: `${getWidthPercent(stage.percentage)}%`,
                    marginLeft: "auto",
                    marginRight: "auto"
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-primary-foreground font-medium">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Drop-off indicator */}
              {index < data.length - 1 && stage.dropoff > 0 && (
                <div className="flex items-center justify-center gap-1 py-1">
                  <TrendingDown className={cn(
                    "h-3 w-3",
                    stage.dropoff < 30 ? "text-green-500" : stage.dropoff < 60 ? "text-yellow-500" : "text-red-500"
                  )} />
                  <span className={cn(
                    "text-[10px]",
                    stage.dropoff < 30 ? "text-green-600" : stage.dropoff < 60 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {stage.dropoff.toFixed(1)}% drop-off
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[10px] text-muted-foreground">&lt;30% loss</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-[10px] text-muted-foreground">30-60% loss</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">&gt;60% loss</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
