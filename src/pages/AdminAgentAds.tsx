import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
    details: "Target Keywords: furnace repair near me, heating system maintenance, emergency furnace service\nEstimated CPC: $4.50\nExpected Reach: 2,500/day\nConversion Rate Estimate: 3.2%",
  },
  {
    id: "2",
    title: "Budget Reallocation Recommendation",
    description: "AI suggests moving $200/week from Display to Search based on ROAS analysis.",
    type: "approval",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    details: "Current Search ROAS: 4.2x\nCurrent Display ROAS: 1.8x\nRecommended: Shift 40% of display budget to search campaigns.",
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
  {
    id: "4",
    title: "Pause Underperforming Campaign",
    description: "AI recommends pausing 'Summer AC' campaign due to seasonal decline.",
    type: "approval",
    status: "pending",
    priority: "low",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    details: "Campaign: Summer AC Specials\nLast 30 Days: $450 spent, 2 conversions\nROAS: 0.4x\nRecommendation: Pause until April",
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
    toast({
      title: "Campaign Approved",
      description: "Changes will be applied shortly.",
    });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({
      title: "Campaign Rejected",
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
    toast({ title: "Refreshed", description: "Ads queue updated." });
  };

  return (
    <AdminLayout 
      title="Ads Agent" 
      subtitle="Review and approve advertising campaigns and optimizations"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <Megaphone className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">$2,450</p>
                <p className="text-sm text-muted-foreground">Monthly Budget</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">3.8x</p>
                <p className="text-sm text-muted-foreground">Avg ROAS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Items */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Ads Queue</h2>
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
                <p className="text-lg font-medium">All ads reviewed!</p>
                <p className="text-muted-foreground">No pending campaigns.</p>
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

export default AdminAgentAds;
