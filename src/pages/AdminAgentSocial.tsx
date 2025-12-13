import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import AgentChatPanel from "@/components/AgentChatPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SOCIAL_AGENT_PROMPT } from "@/data/agentPrompts";
import {
  Share2,
  MessageCircle,
  Heart,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

const mockWorkItems: WorkItem[] = [
  {
    id: "1",
    title: "Reply to Facebook Review",
    description: "Customer left a 4-star review. AI drafted professional response.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Instagram Comment Responses (5)",
    description: "AI generated responses to 5 customer comments on recent posts.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "3",
    title: "Negative Review Alert - Google",
    description: "1-star review received. AI suggests escalation to manager.",
    type: "approval",
    status: "pending",
    priority: "urgent",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

const AdminAgentSocial = () => {
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
    toast({ title: "Response Approved" });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({ title: "Rejected", description: reason, variant: "destructive" });
  };

  const handleDiscuss = (id: string) => {
    toast({ title: "Use Chat Panel", description: "Ask the Social AI." });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast({ title: "Refreshed" });
  };

  return (
    <AdminLayout 
      title="Social Agent" 
      subtitle="AI-powered social media management"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/20">
                    <Share2 className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{workItems.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <MessageCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20">
                    <Clock className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{urgentCount}</p>
                    <p className="text-xs text-muted-foreground">Urgent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Heart className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">4.7</p>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Items */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Social Queue</h2>
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
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {workItems.filter(w => w.status === "pending").length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium">All caught up!</p>
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
          </Tabs>
        </div>

        {/* Right Column - AI Chat */}
        <div className="lg:col-span-1">
          <AgentChatPanel
            agentName="Social"
            agentType="social"
            systemPrompt={SOCIAL_AGENT_PROMPT}
            className="h-[600px] sticky top-4"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAgentSocial;
