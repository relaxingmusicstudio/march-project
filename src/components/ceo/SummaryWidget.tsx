import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  RefreshCw,
  LucideIcon
} from "lucide-react";
import { useClickThrough } from "@/hooks/useClickThrough";
import { cn } from "@/lib/utils";

type EntityType = "leads" | "pipeline" | "content" | "sequences" | "clients" | "approvals" | "vault" | "crm";

interface SummaryWidgetProps {
  title: string;
  value: number | string;
  previousValue?: number;
  icon: LucideIcon;
  entity: EntityType;
  filter?: Record<string, string>;
  format?: "number" | "currency" | "percentage";
  isLoading?: boolean;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  onRefresh?: () => void;
}

export function SummaryWidget({
  title,
  value,
  previousValue,
  icon: Icon,
  entity,
  filter,
  format = "number",
  isLoading = false,
  trend,
  trendLabel,
  badge,
  badgeVariant = "secondary",
  className,
  onRefresh,
}: SummaryWidgetProps) {
  const { navigateToDetail } = useClickThrough();
  const [isHovered, setIsHovered] = useState(false);

  // Calculate trend if not provided but previousValue is
  const calculatedTrend = trend ?? (previousValue !== undefined 
    ? (Number(value) > previousValue ? "up" : Number(value) < previousValue ? "down" : "neutral")
    : undefined);

  const calculatedTrendLabel = trendLabel ?? (previousValue !== undefined && calculatedTrend !== "neutral"
    ? `${Math.abs(((Number(value) - previousValue) / previousValue) * 100).toFixed(1)}%`
    : undefined);

  const formatValue = (val: number | string): string => {
    if (typeof val === "string") return val;
    
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case "percentage":
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const handleClick = () => {
    navigateToDetail(entity, filter);
  };

  if (isLoading) {
    return (
      <Card className={cn("cursor-pointer transition-all hover:shadow-md", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 group",
        isHovered && "ring-2 ring-primary/20",
        className
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground font-medium">{title}</span>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            
            {/* Trend indicator */}
            {calculatedTrend && calculatedTrend !== "neutral" && (
              <div className={cn(
                "flex items-center gap-1 text-xs mt-1",
                calculatedTrend === "up" ? "text-green-600" : "text-red-600"
              )}>
                {calculatedTrend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{calculatedTrendLabel}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {badge && (
              <Badge variant={badgeVariant} className="text-xs">
                {badge}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SummaryWidget;
