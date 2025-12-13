import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface RevenueForecastChartProps {
  historicalData: { date: string; revenue: number }[];
  className?: string;
}

const RevenueForecastChart = ({ historicalData, className = "" }: RevenueForecastChartProps) => {
  const chartData = useMemo(() => {
    if (historicalData.length < 3) return [];

    // Calculate trend using simple linear regression
    const n = historicalData.length;
    const xMean = (n - 1) / 2;
    const yMean = historicalData.reduce((sum, d) => sum + d.revenue, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    historicalData.forEach((d, i) => {
      numerator += (i - xMean) * (d.revenue - yMean);
      denominator += (i - xMean) ** 2;
    });
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Generate forecast for next 7 days
    const today = new Date();
    const combined = historicalData.map((d, i) => ({
      ...d,
      forecast: null as number | null,
      isForecast: false,
    }));

    for (let i = 1; i <= 7; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(forecastDate.getDate() + i);
      const forecastValue = Math.max(0, intercept + slope * (n + i - 1));
      
      combined.push({
        date: forecastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: 0,
        forecast: Math.round(forecastValue),
        isForecast: true,
      });
    }

    return combined;
  }, [historicalData]);

  const trend = useMemo(() => {
    if (historicalData.length < 2) return { direction: "flat", percentage: 0 };
    
    const recent = historicalData.slice(-7);
    const older = historicalData.slice(-14, -7);
    
    if (older.length === 0) return { direction: "flat", percentage: 0 };
    
    const recentAvg = recent.reduce((sum, d) => sum + d.revenue, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.revenue, 0) / older.length;
    
    const change = olderAvg !== 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    
    return {
      direction: change > 5 ? "up" : change < -5 ? "down" : "flat",
      percentage: Math.abs(change).toFixed(1),
    };
  }, [historicalData]);

  const projectedTotal = useMemo(() => {
    return chartData
      .filter(d => d.isForecast)
      .reduce((sum, d) => sum + (d.forecast || 0), 0);
  }, [chartData]);

  if (historicalData.length < 3) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Revenue Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Need more data for forecasting</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Revenue Forecast
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={trend.direction === "up" ? "default" : trend.direction === "down" ? "destructive" : "secondary"}>
              {trend.direction === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : 
               trend.direction === "down" ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
              {trend.percentage}%
            </Badge>
            <span className="text-xs text-muted-foreground">
              +${projectedTotal.toLocaleString()} projected
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                className="text-muted-foreground"
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                labelClassName="font-medium"
              />
              <ReferenceLine x={historicalData[historicalData.length - 1]?.date} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="forecast" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-primary rounded" />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-accent rounded" style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent)) 3px, transparent 3px, transparent 6px)" }} />
            <span>Forecast</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueForecastChart;
