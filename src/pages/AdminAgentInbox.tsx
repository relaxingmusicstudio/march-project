import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Bot,
  User,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

const mockWorkItems: WorkItem[] = [
  {
    id: "1",
    title: "Escalated Chat: Pricing Question",
    description: "Customer asking about enterprise pricing. AI flagged for human follow-up.",
    type: "task",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Customer: John from ABC HVAC\nQuestion: 'Do you offer volume discounts for multiple locations?'\nAI Response: 'Let me connect you with a specialist who can discuss enterprise options.'",
  },
  {
    id: "2",
    title: "AI Response Review: Competitor Comparison",
    description: "Customer asked about competitor differences. Review AI response before sending.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    details: "Customer: 'How are you different from [Competitor]?'\nProposed AI Response: 'Great question! While [Competitor] offers basic call handling, we provide...'",
  },
  {
    id: "3",
    title: "Negative Sentiment Detected",
    description: "Customer expressed frustration about wait times. AI suggests escalation.",
    type: "task",
    status: "pending",
    priority: "urgent",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    details: "Customer: 'This is ridiculous, I've been waiting 20 minutes!'\nSentiment Score: -0.8\nRecommendation: Immediate human takeover",
  },
  {
    id: "4",
    title: "Lead Qualification Complete",
    description: "AI identified hot lead ready for sales follow-up.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    details: "Lead Score: 85/100\nBudget: $5,000/month\nTimeline: This month\nDecision Maker: Yes",
  },
];

const AdminAgentInbox = () => {
  const [workItems, setWorkItems] = useState<WorkItem[]>(mockWorkItems);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const pendingCount = workItems.filter(w => w.status === "pending").length;
  const urgentCount = workItems.filter(w => w.priority === "urgent" && w.status === "pending").length;

  const handleApprove = (id: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "approved" as const } : item
      )
    );
    toast({
      title: "Response Approved",
      description: "The AI response has been sent.",
    });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({
      title: "Response Rejected",
      description: `Reason: ${reason}`,
      variant: "destructive",
    });
  };

  const handleDiscuss = (id: string) => {
    toast({
      title: "Opening CEO Discussion",
      description: "Redirecting to CEO Agent chat...",
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast({ title: "Refreshed", description: "Inbox queue updated." });
  };

  return (
    <AdminLayout 
      title="Inbox Agent" 
      subtitle="Review AI conversations and escalations"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <MessageSquare className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">24</p>
                <p className="text-sm text-muted-foreground">Active Chats</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">89%</p>
                <p className="text-sm text-muted-foreground">AI Handled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/20">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{urgentCount}</p>
                <p className="text-sm text-muted-foreground">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <User className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Need Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Items */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Inbox Queue</h2>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {workItems.filter(w => w.status === "pending").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-muted-foreground">No pending inbox items.</p>
              </CardContent>
            </Card>
          ) : (
            workItems.filter(w => w.status === "pending").map(item => (
              <AgentWorkItem
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onDeny={handleDeny}
                onDiscuss={handleDiscuss}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {workItems.filter(w => w.status !== "pending").map(item => (
            <AgentWorkItem key={item.id} item={item} />
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {workItems.map(item => (
            <AgentWorkItem
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onDiscuss={handleDiscuss}
            />
          ))}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminAgentInbox;
