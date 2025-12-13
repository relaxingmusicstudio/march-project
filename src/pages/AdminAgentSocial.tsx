import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
    description: "Customer left a 4-star review mentioning slow response time. AI drafted professional response.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Proposed Response: 'Thank you for your feedback, [Customer Name]! We're glad you were satisfied with our HVAC service. We take your comments about response time seriously and are working to improve...'",
  },
  {
    id: "2",
    title: "Instagram Comment Responses (5)",
    description: "AI generated responses to 5 customer comments on recent posts.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    details: "Comments on: HVAC Tips Post (2), Service Showcase (2), Team Photo (1). All responses follow brand voice guidelines.",
  },
  {
    id: "3",
    title: "Negative Review Alert - Google",
    description: "1-star review received. AI suggests escalation to manager before responding.",
    type: "approval",
    status: "pending",
    priority: "urgent",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    details: "Review: 'Terrible service, technician was late and rude.' Recommendation: Have manager personally call customer before posting public response.",
  },
  {
    id: "4",
    title: "LinkedIn Engagement Suggestions",
    description: "5 industry posts recommended for comment engagement.",
    type: "task",
    status: "pending",
    priority: "low",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
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
    toast({
      title: "Response Approved",
      description: "The response will be posted shortly.",
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
    toast({ title: "Refreshed", description: "Social queue updated." });
  };

  return (
    <AdminLayout 
      title="Social Agent" 
      subtitle="Manage social media responses and engagement"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <Share2 className="h-6 w-6 text-accent" />
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
                <MessageCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/20">
                <Clock className="h-6 w-6 text-destructive" />
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
              <div className="p-3 rounded-lg bg-green-500/20">
                <Heart className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">4.7</p>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Items */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Social Queue</h2>
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
                <p className="text-muted-foreground">No pending social items.</p>
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

export default AdminAgentSocial;
