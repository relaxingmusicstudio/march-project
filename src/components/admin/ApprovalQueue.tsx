import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Bot, 
  Target, 
  AlertTriangle,
  RefreshCw,
  Eye
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ActionItem {
  id: string;
  agent_type: string;
  action_type: string;
  target_type: string;
  target_id: string;
  action_payload: Record<string, unknown> | null;
  status: string;
  priority: number;
  created_at: string;
  scheduled_at: string | null;
  executed_at: string | null;
  result: Record<string, unknown> | null;
}

export default function ApprovalQueue() {
  const [pendingActions, setPendingActions] = useState<ActionItem[]>([]);
  const [approvedActions, setApprovedActions] = useState<ActionItem[]>([]);
  const [rejectedActions, setRejectedActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchActions = async () => {
    setLoading(true);
    try {
      // Fetch pending actions
      const { data: pending, error: pendingError } = await supabase
        .from("action_queue")
        .select("*")
        .in("status", ["queued", "pending_approval"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (pendingError) throw pendingError;

      // Fetch recently approved/executed actions
      const { data: approved, error: approvedError } = await supabase
        .from("action_queue")
        .select("*")
        .in("status", ["approved", "executed", "completed"])
        .order("executed_at", { ascending: false })
        .limit(20);

      if (approvedError) throw approvedError;

      // Fetch rejected actions
      const { data: rejected, error: rejectedError } = await supabase
        .from("action_queue")
        .select("*")
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(20);

      if (rejectedError) throw rejectedError;

      setPendingActions((pending || []) as ActionItem[]);
      setApprovedActions((approved || []) as ActionItem[]);
      setRejectedActions((rejected || []) as ActionItem[]);
    } catch (error) {
      console.error("Error fetching actions:", error);
      toast.error("Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("action_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "action_queue",
        },
        () => {
          fetchActions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      const { error } = await supabase
        .from("action_queue")
        .update({ 
          status: "approved",
          executed_at: new Date().toISOString()
        })
        .eq("id", actionId);

      if (error) throw error;
      toast.success("Action approved");
      fetchActions();
    } catch (error) {
      console.error("Error approving action:", error);
      toast.error("Failed to approve action");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (actionId: string) => {
    setProcessingId(actionId);
    try {
      const { error } = await supabase
        .from("action_queue")
        .update({ 
          status: "rejected",
          executed_at: new Date().toISOString()
        })
        .eq("id", actionId);

      if (error) throw error;
      toast.success("Action rejected");
      fetchActions();
    } catch (error) {
      console.error("Error rejecting action:", error);
      toast.error("Failed to reject action");
    } finally {
      setProcessingId(null);
    }
  };

  const viewDetails = (action: ActionItem) => {
    setSelectedAction(action);
    setDetailsOpen(true);
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return <Badge variant="destructive">Critical</Badge>;
    if (priority >= 5) return <Badge variant="default">High</Badge>;
    if (priority >= 3) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const getAgentIcon = (agentType: string) => {
    return <Bot className="h-4 w-4" />;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  };

  const ActionCard = ({ action, showActions = false }: { action: ActionItem; showActions?: boolean }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getAgentIcon(action.agent_type)}
              <span className="font-medium text-sm capitalize">
                {action.agent_type.replace(/_/g, " ")}
              </span>
              {getPriorityBadge(action.priority || 5)}
            </div>
            
            <h4 className="font-semibold text-foreground mb-1 capitalize">
              {action.action_type.replace(/_/g, " ")}
            </h4>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-3 w-3" />
              <span className="capitalize">{action.target_type.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground/50">•</span>
              <Clock className="h-3 w-3" />
              <span>{formatTimeAgo(action.created_at)}</span>
            </div>

            {action.action_payload && Object.keys(action.action_payload).length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                {Object.entries(action.action_payload).slice(0, 2).map(([key, value]) => (
                  <div key={key} className="truncate">
                    <span className="font-medium">{key}:</span> {String(value).slice(0, 50)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => viewDetails(action)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            {showActions && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleApprove(action.id)}
                  disabled={processingId === action.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleReject(action.id)}
                  disabled={processingId === action.id}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Approval Queue</h2>
          <p className="text-muted-foreground">
            Review and approve AI agent actions before execution
          </p>
        </div>
        <Button variant="outline" onClick={fetchActions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingActions.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingActions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <ScrollArea className="h-[600px]">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingActions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-40">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-muted-foreground">All caught up! No pending actions.</p>
                </CardContent>
              </Card>
            ) : (
              pendingActions.map((action) => (
                <ActionCard key={action.id} action={action} showActions />
              ))
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <ScrollArea className="h-[600px]">
            {approvedActions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-40">
                  <p className="text-muted-foreground">No approved actions yet.</p>
                </CardContent>
              </Card>
            ) : (
              approvedActions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          <ScrollArea className="h-[600px]">
            {rejectedActions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-40">
                  <p className="text-muted-foreground">No rejected actions.</p>
                </CardContent>
              </Card>
            ) : (
              rejectedActions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {selectedAction?.action_type.replace(/_/g, " ")}
            </DialogTitle>
            <DialogDescription>
              Action details from {selectedAction?.agent_type.replace(/_/g, " ")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Agent</label>
                  <p className="capitalize">{selectedAction.agent_type.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge variant={
                    selectedAction.status === "approved" || selectedAction.status === "executed" 
                      ? "default" 
                      : selectedAction.status === "rejected" 
                        ? "destructive" 
                        : "secondary"
                  }>
                    {selectedAction.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Target Type</label>
                  <p className="capitalize">{selectedAction.target_type.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Target ID</label>
                  <p className="font-mono text-xs">{selectedAction.target_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Priority</label>
                  {getPriorityBadge(selectedAction.priority || 5)}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p>{new Date(selectedAction.created_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedAction.action_payload && Object.keys(selectedAction.action_payload).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action Payload</label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedAction.action_payload, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAction.result && Object.keys(selectedAction.result).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Result</label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedAction.result, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAction.status === "queued" || selectedAction.status === "pending_approval" ? (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleApprove(selectedAction.id);
                      setDetailsOpen(false);
                    }}
                    disabled={processingId === selectedAction.id}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Action
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      handleReject(selectedAction.id);
                      setDetailsOpen(false);
                    }}
                    disabled={processingId === selectedAction.id}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Action
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
