import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  User, 
  Phone, 
  Mail, 
  MessageSquare, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BypassRequest {
  id: string;
  channel: string;
  trigger_keyword: string;
  original_message?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  lead?: {
    name?: string;
    company?: string;
    phone?: string;
  };
}

export default function AdminBypassQueue() {
  const [requests, setRequests] = useState<BypassRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('human-bypass', {
        body: { action: 'get_pending' }
      });

      if (error) throw error;
      setRequests(data.pending_requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resolveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.functions.invoke('human-bypass', {
        body: {
          action: 'resolve',
          request_id: requestId,
          resolution_notes: 'Handled by team member'
        }
      });

      if (error) throw error;
      
      toast.success('Request resolved');
      fetchRequests();
    } catch (error) {
      console.error('Failed to resolve request:', error);
      toast.error('Failed to resolve request');
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <AdminLayout 
      title="Human Bypass Queue" 
      subtitle={`${pendingCount} pending requests requiring human attention`}
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-full">
                  <User className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status === 'assigned').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Assigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">-</p>
                  <p className="text-sm text-muted-foreground">Resolved Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Requests</CardTitle>
                <CardDescription>
                  People who requested human contact - AI is paused on their threads
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchRequests}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">All clear!</h3>
                <p className="text-muted-foreground">No pending human requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const contact = request.contact || request.lead;
                  const name = contact?.name || 'Unknown';
                  const phone = contact?.phone;
                  const company = request.lead?.company;

                  return (
                    <div 
                      key={request.id}
                      className={`p-4 border rounded-lg ${
                        request.status === 'pending' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{name}</span>
                              {company && (
                                <span className="text-sm text-muted-foreground">
                                  at {company}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                {getChannelIcon(request.channel)}
                                {request.channel.toUpperCase()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getTimeAgo(request.created_at)}
                              </span>
                            </div>
                            {request.original_message && (
                              <div className="mt-2 p-2 bg-background rounded text-sm">
                                <span className="font-medium">Trigger: </span>
                                "{request.trigger_keyword}"
                                {request.original_message !== request.trigger_keyword && (
                                  <p className="text-muted-foreground mt-1">
                                    Full message: "{request.original_message}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={request.status === 'pending' ? 'destructive' : 'secondary'}>
                            {request.status}
                          </Badge>
                          {phone && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`tel:${phone}`}>
                                <Phone className="h-4 w-4 mr-1" />
                                Call
                              </a>
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            onClick={() => resolveRequest(request.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>About Human Bypass</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              When a contact replies with <strong>HUMAN</strong> or <strong>STOP</strong>, 
              the AI immediately pauses on that conversation thread.
            </p>
            <p>
              The request appears here for you to handle. After you've contacted them 
              and resolved the issue, click "Resolve" to re-enable AI on their thread.
            </p>
            <p>
              All AI-generated messages include a footer: 
              <span className="italic">"Reply HUMAN to speak with a person"</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
