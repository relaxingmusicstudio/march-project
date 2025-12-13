import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import AgentChatPanel from "@/components/AgentChatPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ADS_AGENT_PROMPT } from "@/data/agentPrompts";
import {
  Megaphone,
  DollarSign,
  TrendingUp,
  CheckCircle,
  RefreshCw,
  Target,
} from "lucide-react";

const mockWorkItems: WorkItem[] = [
  {
    id: "1",
    title: "New Google Ads Campaign: Winter HVAC Specials",
    description: "AI-optimized campaign targeting 'furnace repair' keywords. Budget: $50/day.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Target Keywords: furnace repair near me, heating system maintenance\nEstimated CPC: $4.50",
  },
  {
    id: "2",
    title: "Budget Reallocation Recommendation",
    description: "AI suggests moving $200/week from Display to Search based on ROAS.",
    type: "approval",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "3",
    title: "New Ad Creative Set",
    description: "3 new ad variations for A/B testing on Facebook.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
];

const AdminAgentAds = () => {
  const [workItems, setWorkItems] = useState<WorkItem[]>(mockWorkItems);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const pendingCount = workItems.filter(w => w.status === "pending").length;

  const handleApprove = (id: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "approved" as const } : item
      )
    );
    toast({ title: "Campaign Approved" });
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
    toast({ title: "Use Chat Panel", description: "Ask the Ads AI." });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast({ title: "Refreshed" });
  };

  return (
    <AdminLayout 
      title="Ads Agent" 
      subtitle="AI-powered advertising optimization"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/20">
                    <Megaphone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">8</p>
                    <p className="text-xs text-muted-foreground">Campaigns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">$2.4K</p>
                    <p className="text-xs text-muted-foreground">Budget</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">3.8x</p>
                    <p className="text-xs text-muted-foreground">ROAS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Target className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Items */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ads Queue</h2>
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
                    <p className="text-lg font-medium">All ads reviewed!</p>
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
            agentName="Ads"
            agentType="ads"
            systemPrompt={ADS_AGENT_PROMPT}
            className="h-[600px] sticky top-4"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAgentAds;
