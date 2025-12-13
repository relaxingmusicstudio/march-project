import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import AgentChatPanel from "@/components/AgentChatPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CONTENT_AGENT_PROMPT } from "@/data/agentPrompts";
import {
  FileText,
  PenTool,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

const mockWorkItems: WorkItem[] = [
  {
    id: "1",
    title: "Blog Post: 5 Signs Your HVAC Needs Emergency Repair",
    description: "AI-generated article targeting 'HVAC emergency repair' keywords. Ready for review.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Word count: 1,847. SEO score: 92/100. Includes 3 custom images. Target keywords: HVAC emergency repair, AC breakdown signs, furnace failure symptoms.",
  },
  {
    id: "2",
    title: "Social Media Calendar - Week 51",
    description: "12 posts scheduled across Facebook, Instagram, and LinkedIn.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    details: "Mon: Tips post (FB, IG)\nTue: Customer testimonial (All)\nWed: Service highlight (FB, LI)\nThu: Behind the scenes (IG)\nFri: Weekend promo (All)",
  },
  {
    id: "3",
    title: "Email Newsletter Draft - December",
    description: "Monthly newsletter with winter HVAC maintenance tips and special offers.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "4",
    title: "Video Script: How to Troubleshoot AC Issues",
    description: "3-minute educational video script for YouTube channel.",
    type: "review",
    status: "pending",
    priority: "low",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const AdminAgentContent = () => {
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
      title: "Content Approved",
      description: "The content has been approved for publishing.",
    });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({
      title: "Content Rejected",
      description: `Reason: ${reason}`,
      variant: "destructive",
    });
  };

  const handleDiscuss = (id: string) => {
    toast({
      title: "Use Chat Panel",
      description: "Ask the Content AI about this item.",
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast({ title: "Refreshed", description: "Content queue updated." });
  };

  return (
    <AdminLayout 
      title="Content Agent" 
      subtitle="AI-powered content creation and approval"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/20">
                    <FileText className="h-5 w-5 text-accent" />
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
                    <PenTool className="h-5 w-5 text-yellow-600" />
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
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{approvedCount}</p>
                    <p className="text-xs text-muted-foreground">Published</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">12</p>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Items */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Content Queue</h2>
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
                    <p className="text-lg font-medium">All content reviewed!</p>
                    <p className="text-muted-foreground">No pending content to approve.</p>
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
            agentName="Content"
            agentType="content"
            systemPrompt={CONTENT_AGENT_PROMPT}
            className="h-[600px] sticky top-4"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAgentContent;
