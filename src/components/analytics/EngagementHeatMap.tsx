import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Flame, Clock } from "lucide-react";

interface EngagementData {
  hour: number;
  day: string;
  count: number;
}

interface EngagementHeatMapProps {
  data: EngagementData[];
  isLoading?: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function EngagementHeatMap({ data, isLoading }: EngagementHeatMapProps) {
  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getColor = (count: number) => {
    const intensity = count / maxCount;
    if (intensity === 0) return "bg-muted/30";
    if (intensity < 0.25) return "bg-primary/20";
    if (intensity < 0.5) return "bg-primary/40";
    if (intensity < 0.75) return "bg-primary/60";
    return "bg-primary/90";
  };

  const getCell = (day: string, hour: number) => {
    const cell = data.find(d => d.day === day && d.hour === hour);
    return cell?.count || 0;
  };

  // Find peak hours
  const peakHours = data
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(d => `${d.day} ${d.hour}:00`);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            Engagement Heat Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {DAYS.map(day => (
              <div key={day} className="flex gap-1">
                <div className="w-8 h-4 bg-muted rounded" />
                {HOURS.filter(h => h % 3 === 0).map(hour => (
                  <div key={hour} className="w-6 h-4 bg-muted/50 rounded" />
                ))}
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
            <Flame className="h-4 w-4 text-primary" />
            Engagement Heat Map
          </div>
          <Badge variant="secondary" className="text-xs">
            7-day activity
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Peak hours */}
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Peak:</span>
          {peakHours.map((peak, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {peak}
            </Badge>
          ))}
        </div>

        {/* Heat map grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10" /> {/* Spacer for day labels */}
              {HOURS.filter(h => h % 3 === 0).map(hour => (
                <div key={hour} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {hour.toString().padStart(2, "0")}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {DAYS.map(day => (
              <div key={day} className="flex items-center gap-0.5 mb-0.5">
                <div className="w-10 text-xs text-muted-foreground">{day}</div>
                {HOURS.map(hour => {
                  const count = getCell(day, hour);
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 h-5 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary/50",
                        getColor(count)
                      )}
                      title={`${day} ${hour}:00 - ${count} events`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
          <span className="text-[10px] text-muted-foreground">Low</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-3 rounded-sm bg-muted/30" />
            <div className="w-4 h-3 rounded-sm bg-primary/20" />
            <div className="w-4 h-3 rounded-sm bg-primary/40" />
            <div className="w-4 h-3 rounded-sm bg-primary/60" />
            <div className="w-4 h-3 rounded-sm bg-primary/90" />
          </div>
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
      </CardContent>
    </Card>
  );
}
