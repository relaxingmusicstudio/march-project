import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Power, 
  Zap, 
  Wrench, 
  Palmtree, 
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  Shield,
  Bell,
  Smartphone,
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SystemMode = 'growth' | 'maintenance' | 'vacation' | 'emergency';

interface RuleOfEngagement {
  id: string;
  rule_name: string;
  rule_type: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  is_active: boolean;
  priority: number;
}

const modeConfig: Record<SystemMode, { 
  icon: React.ReactNode; 
  color: string; 
  description: string;
  bgColor: string;
}> = {
  growth: {
    icon: <Zap className="h-8 w-8" />,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 border-green-500/30',
    description: 'AI is aggressive in lead gen and outreach. Maximum growth mode.'
  },
  maintenance: {
    icon: <Wrench className="h-8 w-8" />,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    description: 'AI focuses only on existing clients and inbound leads. Pauses cold outreach.'
  },
  vacation: {
    icon: <Palmtree className="h-8 w-8" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    description: 'AI enters read-only mode. Sends critical alerts only. Complete silence.'
  },
  emergency: {
    icon: <AlertTriangle className="h-8 w-8" />,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/30',
    description: 'Emergency stop. All AI actions halted. Manual intervention required.'
  }
};

export default function AdminControlPanel() {
  const [currentMode, setCurrentMode] = useState<SystemMode>('growth');
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [rules, setRules] = useState<RuleOfEngagement[]>([]);
  const [pauseDuration, setPauseDuration] = useState(2);
  const [modeHistory, setModeHistory] = useState<Array<{
    mode: string;
    activated_at: string;
    reason?: string;
  }>>([]);

  useEffect(() => {
    fetchCurrentMode();
    fetchRules();
  }, []);

  const fetchCurrentMode = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('business-context', {
        body: { action: 'get_current_mode' }
      });

      if (error) throw error;

      setCurrentMode(data.current_mode as SystemMode);
      setModeHistory(data.mode_history || []);
    } catch (error) {
      console.error('Failed to fetch mode:', error);
      toast.error('Failed to fetch current mode');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('business-context', {
        body: { action: 'get_roe' }
      });

      if (error) throw error;
      setRules(data.rules || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  const switchMode = async (newMode: SystemMode, duration?: number) => {
    setIsSwitching(true);
    try {
      const { data, error } = await supabase.functions.invoke('business-context', {
        body: {
          action: 'set_mode',
          mode: newMode,
          reason: `Switched via Control Panel`,
          duration_hours: duration
        }
      });

      if (error) throw error;

      setCurrentMode(newMode);
      toast.success(`Switched to ${newMode.toUpperCase()} mode`);
      fetchCurrentMode(); // Refresh history
    } catch (error) {
      console.error('Failed to switch mode:', error);
      toast.error('Failed to switch mode');
    } finally {
      setIsSwitching(false);
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('business-context', {
        body: {
          action: 'update_roe',
          rule_id: ruleId,
          rule_data: { is_active: isActive }
        }
      });

      if (error) throw error;

      setRules(rules.map(r => r.id === ruleId ? { ...r, is_active: isActive } : r));
      toast.success(`Rule ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const getRuleIcon = (ruleType: string) => {
    switch (ruleType) {
      case 'time_restriction': return <Clock className="h-4 w-4" />;
      case 'budget_limit': return <DollarSign className="h-4 w-4" />;
      case 'pipeline_limit': return <Users className="h-4 w-4" />;
      case 'approval_required': return <Shield className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Control Panel" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Control Panel" 
      subtitle="Mission Control for your AI business operations"
    >
      <div className="space-y-6">
        {/* Current Mode Display */}
        <Card className={`border-2 ${modeConfig[currentMode].bgColor}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={modeConfig[currentMode].color}>
                  {modeConfig[currentMode].icon}
                </div>
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    Current Mode: 
                    <span className={modeConfig[currentMode].color}>
                      {currentMode.toUpperCase()}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    {modeConfig[currentMode].description}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={currentMode === 'growth' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                {currentMode === 'growth' ? 'ACTIVE' : currentMode === 'emergency' ? 'HALTED' : 'LIMITED'}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="modes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="modes">System Modes</TabsTrigger>
            <TabsTrigger value="rules">Rules of Engagement</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* System Modes Tab */}
          <TabsContent value="modes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(modeConfig) as SystemMode[]).map((mode) => (
                <Card 
                  key={mode}
                  className={`cursor-pointer transition-all hover:scale-[1.02] ${
                    currentMode === mode ? modeConfig[mode].bgColor : 'hover:bg-accent/50'
                  }`}
                  onClick={() => !isSwitching && switchMode(mode)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${modeConfig[mode].bgColor}`}>
                          <div className={modeConfig[mode].color}>
                            {modeConfig[mode].icon}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg capitalize">{mode}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {modeConfig[mode].description}
                          </p>
                        </div>
                      </div>
                      {currentMode === mode && (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Pause */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Quick Pause
                </CardTitle>
                <CardDescription>
                  Temporarily pause AI outreach for a set duration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Duration: {pauseDuration} hours</Label>
                    <Slider
                      value={[pauseDuration]}
                      onValueChange={([val]) => setPauseDuration(val)}
                      min={1}
                      max={24}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                  <Button 
                    onClick={() => switchMode('maintenance', pauseDuration)}
                    disabled={isSwitching}
                    variant="outline"
                  >
                    Pause for {pauseDuration}h
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Mode History */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Mode Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {modeHistory.slice(0, 5).map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={modeConfig[entry.mode as SystemMode]?.color || 'text-muted-foreground'}>
                          {modeConfig[entry.mode as SystemMode]?.icon || <Power className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className="font-medium capitalize">{entry.mode}</span>
                          {entry.reason && (
                            <p className="text-xs text-muted-foreground">{entry.reason}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(entry.activated_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules of Engagement Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Rules of Engagement
                </CardTitle>
                <CardDescription>
                  Set boundaries the AI cannot cross. These rules apply across all modes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded">
                          {getRuleIcon(rule.rule_type)}
                        </div>
                        <div>
                          <h4 className="font-medium">{rule.rule_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {rule.rule_type.replace('_', ' ')} • Priority: {rule.priority}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Business Hours & Calendar Integration
                </CardTitle>
                <CardDescription>
                  Connect your calendar to automatically adjust AI behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Business Start Time</Label>
                      <Input type="time" defaultValue="09:00" className="mt-1" />
                    </div>
                    <div>
                      <Label>Business End Time</Label>
                      <Input type="time" defaultValue="18:00" className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label>Business Days</Label>
                    <div className="flex gap-2 mt-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                        <Button
                          key={day}
                          variant={idx < 5 ? 'default' : 'outline'}
                          size="sm"
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Calendar Sync</h4>
                    <Button variant="outline" className="w-full">
                      <Calendar className="h-4 w-4 mr-2" />
                      Connect Google Calendar
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      AI will automatically switch to MAINTENANCE mode during your calendar events marked as "busy"
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Configure how and when you receive alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { type: 'Hot Lead Alert', priority: 'critical', description: 'When a high-score lead is ready to close' },
                    { type: 'Human Request', priority: 'critical', description: 'When someone replies HUMAN or STOP' },
                    { type: 'Budget Threshold', priority: 'important', description: 'When ad spend reaches 80% of limit' },
                    { type: 'Daily Summary', priority: 'informative', description: 'End of day performance report' },
                    { type: 'Weekly Report', priority: 'informative', description: 'Weekly business intelligence' }
                  ].map((notif, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Bell className={`h-5 w-5 ${
                          notif.priority === 'critical' ? 'text-red-500' :
                          notif.priority === 'important' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <h4 className="font-medium">{notif.type}</h4>
                          <p className="text-sm text-muted-foreground">{notif.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{notif.priority}</Badge>
                        <Switch defaultChecked={notif.priority !== 'informative'} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 mt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Mobile App
                  </h4>
                  <Button variant="outline" className="w-full">
                    Install ApexLocal360 App
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Get push notifications and control your AI from anywhere
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
