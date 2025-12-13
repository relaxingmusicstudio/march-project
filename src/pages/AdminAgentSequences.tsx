import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Mail,
  Users,
  CheckCircle,
  RefreshCw,
  Clock,
} from "lucide-react";

const mockWorkItems: WorkItem[] = [
  {
    id: "1",
    title: "New Sequence: Hot Lead Nurture",
    description: "AI-designed 5-email sequence for leads scoring 70+. Ready for review.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Email 1 (Day 0): Personal introduction\nEmail 2 (Day 2): Case study\nEmail 3 (Day 5): Special offer\nEmail 4 (Day 8): Urgency reminder\nEmail 5 (Day 12): Final follow-up",
  },
  {
    id: "2",
    title: "Sequence Optimization: Welcome Series",
    description: "AI recommends changes to improve 12% lower open rate.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    details: "Current Open Rate: 28%\nIndustry Average: 32%\nRecommended Changes:\n- Shorten subject lines\n- Move CTA higher\n- Add personalization tokens",
  },
  {
    id: "3",
    title: "Pause Sequence: Cold Outreach v2",
    description: "High unsubscribe rate detected. AI recommends pause for review.",
    type: "approval",
    status: "pending",
    priority: "urgent",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    details: "Unsubscribe Rate: 4.2% (Threshold: 2%)\nComplaints: 3 this week\nRecommendation: Pause and revise messaging",
  },
  {
    id: "4",
    title: "Add 15 Leads to Nurture Sequence",
    description: "New leads from last week ready for automated nurture.",
    type: "task",
    status: "pending",
    priority: "low",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const AdminAgentSequences = () => {
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
      title: "Sequence Approved",
      description: "Changes will be applied.",
    });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({
      title: "Sequence Rejected",
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
    toast({ title: "Refreshed", description: "Sequences queue updated." });
  };

  return (
    <AdminLayout 
      title="Sequences Agent" 
      subtitle="Manage email sequences and automation workflows"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">6</p>
                <p className="text-sm text-muted-foreground">Active Sequences</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">142</p>
                <p className="text-sm text-muted-foreground">Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">32%</p>
                <p className="text-sm text-muted-foreground">Open Rate</p>
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
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Items */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Sequences Queue</h2>
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
                <p className="text-lg font-medium">All sequences reviewed!</p>
                <p className="text-muted-foreground">No pending items.</p>
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

export default AdminAgentSequences;
