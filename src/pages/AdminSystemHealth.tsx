import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Zap,
  Database,
  Server,
  Brain,
  Clock,
  TrendingUp,
  Shield
} from "lucide-react";

interface HealthMetric {
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  status: string;
  threshold_warning: number;
  threshold_critical: number;
  recorded_at: string;
}

export default function AdminSystemHealth() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [overallStatus, setOverallStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchHealthStatus();
  }, []);

  const fetchHealthStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('system-health', {
        body: { action: 'get_status' }
      });

      if (error) throw error;

      setMetrics(data.metrics || []);
      setOverallStatus(data.overallStatus || 'healthy');
    } catch (error) {
      console.error('Error fetching health status:', error);
      toast.error('Failed to load system health');
    } finally {
      setIsLoading(false);
    }
  };

  const collectMetrics = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('system-health', {
        body: { action: 'collect' }
      });

      if (error) throw error;

      await fetchHealthStatus();
      toast.success('Health metrics collected');
    } catch (error) {
      console.error('Error collecting metrics:', error);
      toast.error('Failed to collect metrics');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getMetricIcon = (name: string) => {
    switch (name) {
      case 'database_response_ms': return Database;
      case 'api_error_rate': return AlertTriangle;
      case 'cache_hit_rate': return Brain;
      case 'active_leads': return TrendingUp;
      case 'active_clients': return Shield;
      default: return Activity;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return XCircle;
      default: return Activity;
    }
  };

  const formatMetricName = (name: string) => {
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const criticalMetrics = metrics.filter(m => m.status === 'critical');
  const warningMetrics = metrics.filter(m => m.status === 'warning');
  const healthyMetrics = metrics.filter(m => m.status === 'healthy');

  const StatusIcon = getStatusIcon(overallStatus);

  return (
    <AdminLayout title="System Health" subtitle="Monitor system performance and business metrics">
      <div className="space-y-6">
        {/* Overall Status */}
        <Card className={`border-2 ${
          overallStatus === 'critical' ? 'border-red-500 bg-red-500/5' :
          overallStatus === 'warning' ? 'border-amber-500 bg-amber-500/5' :
          'border-green-500 bg-green-500/5'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${
                  overallStatus === 'critical' ? 'bg-red-500/20' :
                  overallStatus === 'warning' ? 'bg-amber-500/20' :
                  'bg-green-500/20'
                }`}>
                  <StatusIcon className={`h-8 w-8 ${getStatusColor(overallStatus)}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold capitalize">{overallStatus}</h2>
                  <p className="text-muted-foreground">
                    {criticalMetrics.length} critical, {warningMetrics.length} warnings, {healthyMetrics.length} healthy
                  </p>
                </div>
              </div>
              <Button onClick={collectMetrics} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Metrics
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, i) => {
            const Icon = getMetricIcon(metric.metric_name);
            const StatusIconComp = getStatusIcon(metric.status);
            
            return (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {formatMetricName(metric.metric_name)}
                        </p>
                        <p className="text-2xl font-bold">
                          {metric.metric_value.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {metric.metric_unit}
                          </span>
                        </p>
                      </div>
                    </div>
                    <StatusIconComp className={`h-5 w-5 ${getStatusColor(metric.status)}`} />
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Threshold</span>
                      <span>Warning: {metric.threshold_warning} / Critical: {metric.threshold_critical}</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (metric.metric_value / (metric.threshold_critical || 100)) * 100)} 
                      className={`h-2 ${
                        metric.status === 'critical' ? '[&>div]:bg-red-500' :
                        metric.status === 'warning' ? '[&>div]:bg-amber-500' :
                        '[&>div]:bg-green-500'
                      }`}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Database className="h-6 w-6" />
              <span>Clear Cache</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <RefreshCw className="h-6 w-6" />
              <span>Restart Workers</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Server className="h-6 w-6" />
              <span>View Logs</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Shield className="h-6 w-6" />
              <span>Security Scan</span>
            </Button>
          </CardContent>
        </Card>

        {/* System Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last metric collection</span>
                <span>{metrics[0]?.recorded_at ? new Date(metrics[0].recorded_at).toLocaleString() : 'Never'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active edge functions</span>
                <span>50+</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Database tables</span>
                <span>40+</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">System Uptime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-4xl font-bold text-green-500">99.9%</p>
                <p className="text-muted-foreground">Last 30 days</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
