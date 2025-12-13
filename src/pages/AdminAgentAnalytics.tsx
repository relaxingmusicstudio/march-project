import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

// Mock work items for the Analytics Agent
const mockWorkItems: WorkItem[] = [
  {
    id: "1",
    title: "Weekly Performance Report",
    description: "AI-generated analysis of this week's key metrics with recommendations.",
    type: "review",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Traffic up 23% from last week. Conversion rate improved to 4.2%. Top performing page: /pricing. Recommendation: Increase budget on Google Ads campaign targeting 'HVAC emergency'.",
  },
  {
    id: "2",
    title: "Anomaly Detection: Bounce Rate Spike",
    description: "Detected unusual 45% increase in bounce rate on mobile devices.",
    type: "approval",
    status: "pending",
    priority: "urgent",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    details: "Mobile bounce rate increased from 35% to 51% over the last 24 hours. Primary affected pages: Home, Pricing. Possible cause: Recent CSS change affecting mobile layout.",
  },
  {
    id: "3",
    title: "New Dashboard Widget Proposal",
    description: "Recommending addition of real-time visitor map to CEO Console.",
    type: "approval",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const AdminAgentAnalytics = () => {
  const [workItems, setWorkItems] = useState<WorkItem[]>(mockWorkItems);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const pendingCount = workItems.filter(w => w.status === "pending").length;
  const approvedCount = workItems.filter(w => w.status === "approved").length;

  const handleApprove = (id: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "approved" as const } : item
      )
    );
    toast({
      title: "Item Approved",
      description: "The work item has been approved successfully.",
    });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({
      title: "Item Denied",
      description: `Reason: ${reason}`,
      variant: "destructive",
    });
  };

  const handleDiscuss = (id: string) => {
    toast({
      title: "Opening CEO Discussion",
      description: "Redirecting to CEO Agent chat...",
    });
    // TODO: Implement CEO chat integration
  };

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast({
      title: "Refreshed",
      description: "Work items have been updated.",
    });
  };

  return (
    <AdminLayout 
      title="Analytics Agent" 
      subtitle="Review data insights, reports, and recommendations"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workItems.length}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/20">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {workItems.filter(w => w.priority === "urgent").length}
                </p>
                <p className="text-sm text-muted-foreground">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Items */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Work Queue</h2>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
            )}
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
                <p className="text-muted-foreground">No pending items to review.</p>
              </CardContent>
            </Card>
          ) : (
            workItems
              .filter(w => w.status === "pending")
              .map(item => (
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
          {workItems
            .filter(w => w.status !== "pending")
            .map(item => (
              <AgentWorkItem
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onDeny={handleDeny}
                onDiscuss={handleDiscuss}
              />
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

export default AdminAgentAnalytics;
