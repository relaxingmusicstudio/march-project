import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Rocket, 
  Zap,
  Database,
  Mail,
  CreditCard,
  Mic,
  Video,
  Brain
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IntegrationResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'skipped';
  message: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
}

interface TestResults {
  success: boolean;
  timestamp: string;
  summary: {
    total: number;
    success: number;
    error: number;
    warning: number;
    skipped: number;
  };
  results: IntegrationResult[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    default:
      return <div className="w-5 h-5 rounded-full bg-muted" />;
  }
};

const getIntegrationIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('ai') || lower.includes('lovable')) return <Brain className="w-5 h-5" />;
  if (lower.includes('eleven')) return <Mic className="w-5 h-5" />;
  if (lower.includes('database')) return <Database className="w-5 h-5" />;
  if (lower.includes('stripe')) return <CreditCard className="w-5 h-5" />;
  if (lower.includes('resend')) return <Mail className="w-5 h-5" />;
  if (lower.includes('d-id') || lower.includes('avatar')) return <Video className="w-5 h-5" />;
  return <Zap className="w-5 h-5" />;
};

const AdminPreLaunch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);

  const runTests = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-integrations', {
        body: { integrations: ['all'] },
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.success) {
        toast.success('All integrations are healthy!');
      } else {
        toast.warning(`${data.summary.error} integration(s) have issues`);
      }
    } catch (err) {
      console.error('Test error:', err);
      toast.error('Failed to run integration tests');
    } finally {
      setIsLoading(false);
    }
  };

  const getOverallStatus = () => {
    if (!results) return 'pending';
    if (results.summary.error > 0) return 'error';
    if (results.summary.warning > 0) return 'warning';
    return 'success';
  };

  return (
    <AdminLayout title="Pre-Launch Checklist">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Rocket className="w-8 h-8 text-primary" />
              Pre-Launch Checklist
            </h1>
            <p className="text-muted-foreground mt-1">
              Verify all integrations are configured and working before going live
            </p>
          </div>
          <Button 
            onClick={runTests} 
            disabled={isLoading}
            size="lg"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Testing...' : 'Run All Tests'}
          </Button>
        </div>

        {/* Summary Card */}
        {results && (
          <Card className={`border-2 ${
            getOverallStatus() === 'success' ? 'border-green-500/50 bg-green-500/5' :
            getOverallStatus() === 'error' ? 'border-destructive/50 bg-destructive/5' :
            'border-yellow-500/50 bg-yellow-500/5'
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getOverallStatus() === 'success' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                {getOverallStatus() === 'error' && <XCircle className="w-6 h-6 text-destructive" />}
                {getOverallStatus() === 'warning' && <AlertTriangle className="w-6 h-6 text-yellow-500" />}
                {getOverallStatus() === 'success' ? 'Ready for Launch!' : 
                 getOverallStatus() === 'error' ? 'Issues Found' : 'Warnings Detected'}
              </CardTitle>
              <CardDescription>
                Last tested: {new Date(results.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                    {results.summary.success} Passed
                  </Badge>
                </div>
                {results.summary.error > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      {results.summary.error} Failed
                    </Badge>
                  </div>
                )}
                {results.summary.warning > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                      {results.summary.warning} Warnings
                    </Badge>
                  </div>
                )}
                {results.summary.skipped > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {results.summary.skipped} Skipped
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Integration Results */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results?.results.map((result, index) => (
            <Card key={index} className={`${
              result.status === 'error' ? 'border-destructive/50' :
              result.status === 'warning' ? 'border-yellow-500/50' :
              result.status === 'success' ? 'border-green-500/50' :
              'border-border'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getIntegrationIcon(result.name)}
                    </div>
                    <CardTitle className="text-base">{result.name}</CardTitle>
                  </div>
                  {getStatusIcon(result.status)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.latency_ms && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Response time: {result.latency_ms}ms
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Placeholder cards when no results */}
          {!results && ['Lovable AI', 'ElevenLabs', 'Database', 'Stripe', 'Resend', 'D-ID (Avatar)'].map((name, index) => (
            <Card key={index} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getIntegrationIcon(name)}
                    </div>
                    <CardTitle className="text-base">{name}</CardTitle>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Click "Run All Tests" to verify</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cost Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Voice & Video Stack Summary</CardTitle>
            <CardDescription>Current integration configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">In-House (Lovable AI)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Text/Chat AI</li>
                    <li>• Image Generation</li>
                    <li>• Video Generation (Veo 3)</li>
                    <li>• Reasoning & Analysis</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">External Integrations</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• ElevenLabs: Voice AI, TTS, STT</li>
                    <li>• D-ID: Avatar Videos (fallback)</li>
                    <li>• Twilio: Phone Carrier</li>
                    <li>• Resend: Email Delivery</li>
                    <li>• Stripe: Payments</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPreLaunch;
