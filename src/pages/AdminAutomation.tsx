import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Zap,
  Video,
  Image,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Music,
  Wand2
} from 'lucide-react';
import { format } from 'date-fns';

interface AutomationFunction {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  schedule: string;
  endpoint: string;
  category: 'discovery' | 'generation' | 'management';
}

interface AutomationLog {
  id: string;
  function_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  items_processed: number | null;
  items_created: number | null;
  error_message: string | null;
}

const automationFunctions: AutomationFunction[] = [
  {
    id: 'youtube-trend-scraper',
    name: 'YouTube Trend Scraper',
    description: 'Discovers trending HVAC videos and extracts content ideas',
    icon: <TrendingUp className="h-5 w-5" />,
    schedule: 'Every 6 hours',
    endpoint: 'youtube-trend-scraper',
    category: 'discovery'
  },
  {
    id: 'youtube-discover',
    name: 'YouTube Channel Discovery',
    description: 'Finds new HVAC channels and influencers to monitor',
    icon: <Video className="h-5 w-5" />,
    schedule: 'Daily at midnight',
    endpoint: 'youtube-discover',
    category: 'discovery'
  },
  {
    id: 'content-generator',
    name: 'Content Generator',
    description: 'Auto-generates blog posts and social media content from ideas',
    icon: <FileText className="h-5 w-5" />,
    schedule: 'Every 4 hours',
    endpoint: 'content-generator',
    category: 'generation'
  },
  {
    id: 'content-image',
    name: 'Image Generator',
    description: 'Creates marketing images using Nano Banana AI',
    icon: <Image className="h-5 w-5" />,
    schedule: 'Every 4 hours',
    endpoint: 'content-image',
    category: 'generation'
  },
  {
    id: 'did-video',
    name: 'D-ID Video Generator',
    description: 'Creates AI avatar videos for social media',
    icon: <Video className="h-5 w-5" />,
    schedule: 'Daily at 9 AM',
    endpoint: 'did-video',
    category: 'generation'
  },
  {
    id: 'content-calendar-checker',
    name: 'Calendar Checker',
    description: 'Monitors content calendar and creates alerts for gaps',
    icon: <Calendar className="h-5 w-5" />,
    schedule: 'Every 2 hours',
    endpoint: 'content-calendar-checker',
    category: 'management'
  },
  {
    id: 'lead-score-refresher',
    name: 'Lead Score Refresher',
    description: 'Updates lead temperatures and identifies hot leads',
    icon: <Users className="h-5 w-5" />,
    schedule: 'Every hour',
    endpoint: 'lead-score-refresher',
    category: 'management'
  }
];

export default function AdminAutomation() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [runningFunctions, setRunningFunctions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch automation logs');
    } else {
      setLogs(data || []);
    }
    setIsLoading(false);
  };

  const runFunction = async (func: AutomationFunction) => {
    setRunningFunctions(prev => new Set(prev).add(func.id));
    toast.info(`Starting ${func.name}...`);

    try {
      // Log the start
      const { data: logEntry } = await supabase
        .from('automation_logs')
        .insert({
          function_name: func.id,
          status: 'running',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      // Call the edge function
      const { data, error } = await supabase.functions.invoke(func.endpoint, {
        body: { manual_trigger: true }
      });

      if (error) throw error;

      // Update log with success
      if (logEntry) {
        await supabase
          .from('automation_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_processed: data?.items_processed || 0,
            items_created: data?.items_created || 0
          })
          .eq('id', logEntry.id);
      }

      toast.success(`${func.name} completed successfully!`);
      fetchLogs();
    } catch (error: any) {
      console.error(`Error running ${func.name}:`, error);
      toast.error(`${func.name} failed: ${error.message}`);
      
      // Log the error
      await supabase
        .from('automation_logs')
        .insert({
          function_name: func.id,
          status: 'failed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: error.message
        });
      
      fetchLogs();
    } finally {
      setRunningFunctions(prev => {
        const next = new Set(prev);
        next.delete(func.id);
        return next;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryFunctions = (category: AutomationFunction['category']) => 
    automationFunctions.filter(f => f.category === category);

  return (
    <AdminLayout title="Automation Dashboard" subtitle="Test, monitor, and manage automated workflows">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
          </div>
          <Button onClick={fetchLogs} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Logs
          </Button>
        </div>

        <Tabs defaultValue="functions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="functions">Functions</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="audio">Audio & Effects</TabsTrigger>
          </TabsList>

          <TabsContent value="functions" className="space-y-6">
            {/* Content Discovery */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Content Discovery
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {getCategoryFunctions('discovery').map(func => (
                  <FunctionCard 
                    key={func.id} 
                    func={func} 
                    isRunning={runningFunctions.has(func.id)}
                    onRun={() => runFunction(func)}
                    logs={logs.filter(l => l.function_name === func.id).slice(0, 3)}
                  />
                ))}
              </div>
            </div>

            {/* Content Generation */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Content Generation
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {getCategoryFunctions('generation').map(func => (
                  <FunctionCard 
                    key={func.id} 
                    func={func} 
                    isRunning={runningFunctions.has(func.id)}
                    onRun={() => runFunction(func)}
                    logs={logs.filter(l => l.function_name === func.id).slice(0, 3)}
                  />
                ))}
              </div>
            </div>

            {/* Management */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Workflow Management
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {getCategoryFunctions('management').map(func => (
                  <FunctionCard 
                    key={func.id} 
                    func={func} 
                    isRunning={runningFunctions.has(func.id)}
                    onRun={() => runFunction(func)}
                    logs={logs.filter(l => l.function_name === func.id).slice(0, 3)}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Automation Logs</CardTitle>
                <CardDescription>Recent automation runs and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {isLoading ? (
                      <p className="text-muted-foreground text-center py-8">Loading logs...</p>
                    ) : logs.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No automation logs yet. Run a function to see logs here.</p>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                          <div className="space-y-1">
                            <p className="font-medium">{log.function_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(log.started_at), 'MMM d, yyyy h:mm a')}
                            </p>
                            {log.error_message && (
                              <p className="text-sm text-red-400">{log.error_message}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {log.items_processed !== null && (
                              <div className="text-right text-sm">
                                <p className="text-muted-foreground">Processed: {log.items_processed}</p>
                                <p className="text-muted-foreground">Created: {log.items_created || 0}</p>
                              </div>
                            )}
                            {getStatusBadge(log.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audio">
            <AudioEffectsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function FunctionCard({ 
  func, 
  isRunning, 
  onRun, 
  logs 
}: { 
  func: AutomationFunction; 
  isRunning: boolean; 
  onRun: () => void;
  logs: AutomationLog[];
}) {
  const lastRun = logs[0];
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {func.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{func.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{func.schedule}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{func.description}</p>
        
        {lastRun && (
          <div className="text-xs text-muted-foreground">
            Last run: {format(new Date(lastRun.started_at), 'MMM d, h:mm a')} - 
            <span className={lastRun.status === 'completed' ? ' text-green-400' : lastRun.status === 'failed' ? ' text-red-400' : ''}>
              {' '}{lastRun.status}
            </span>
          </div>
        )}
        
        <Button 
          onClick={onRun} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Test Function
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function AudioEffectsPanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState('Upbeat corporate background music for HVAC promotional video');
  const [sfxPrompt, setSfxPrompt] = useState('Air conditioning unit starting up, mechanical hum');

  const testMusicGeneration = async () => {
    setIsGenerating(true);
    toast.info('Music generation requires ELEVENLABS_API_KEY. Add it in settings to enable.');
    setIsGenerating(false);
  };

  const testSfxGeneration = async () => {
    setIsGenerating(true);
    toast.info('SFX generation requires ELEVENLABS_API_KEY. Add it in settings to enable.');
    setIsGenerating(false);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Background Music
          </CardTitle>
          <CardDescription>
            Generate studio-quality music tracks using ElevenLabs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm font-medium">How it works:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Text-to-music generation</li>
              <li>• Various genres and moods</li>
              <li>• Up to 60 second tracks</li>
              <li>• Perfect for video backgrounds</li>
            </ul>
          </div>
          
          <textarea
            className="w-full p-3 rounded-lg border bg-background text-sm"
            rows={3}
            value={musicPrompt}
            onChange={(e) => setMusicPrompt(e.target.value)}
            placeholder="Describe the music you want..."
          />
          
          <Button onClick={testMusicGeneration} disabled={isGenerating} className="w-full">
            <Music className="h-4 w-4 mr-2" />
            Generate Music (Requires API Key)
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Requires ELEVENLABS_API_KEY secret
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Sound Effects
          </CardTitle>
          <CardDescription>
            Generate realistic sound effects from text descriptions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm font-medium">How it works:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Text-to-SFX generation</li>
              <li>• Up to 22 seconds</li>
              <li>• Realistic environmental sounds</li>
              <li>• Perfect for video enhancement</li>
            </ul>
          </div>
          
          <textarea
            className="w-full p-3 rounded-lg border bg-background text-sm"
            rows={3}
            value={sfxPrompt}
            onChange={(e) => setSfxPrompt(e.target.value)}
            placeholder="Describe the sound effect..."
          />
          
          <Button onClick={testSfxGeneration} disabled={isGenerating} className="w-full">
            <Zap className="h-4 w-4 mr-2" />
            Generate SFX (Requires API Key)
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Requires ELEVENLABS_API_KEY secret
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Video Overlays & Graphics
          </CardTitle>
          <CardDescription>
            Generate overlay images using Nano Banana (already configured!)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Lower Thirds</h4>
              <p className="text-sm text-muted-foreground">Generate text overlays for names, titles, contact info</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Call-to-Action Buttons</h4>
              <p className="text-sm text-muted-foreground">Create animated CTA graphics for videos</p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Logo Animations</h4>
              <p className="text-sm text-muted-foreground">Generate intro/outro logo sequences</p>
            </div>
          </div>
          
          <div className="mt-4 p-4 rounded-lg bg-primary/10">
            <p className="text-sm">
              <strong>Already Available:</strong> The content-image function uses Nano Banana (google/gemini-2.5-flash-image-preview) 
              which is configured with LOVABLE_API_KEY. You can generate and edit images for overlays without any additional API keys!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
