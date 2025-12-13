import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import AgentWorkItem, { WorkItem } from "@/components/AgentWorkItem";
import AgentChatPanel from "@/components/AgentChatPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { YOUTUBE_AGENT_PROMPT } from "@/data/agentPrompts";
import {
  Youtube,
  TrendingUp,
  Eye,
  Users,
  Clock,
  RefreshCw,
  Play,
  ThumbsUp,
  MessageSquare,
} from "lucide-react";

interface VideoIdea {
  id: string;
  title: string;
  description: string;
  viralScore: number;
  status: "new" | "scripted" | "filmed" | "published";
  suggestedFormats: string[];
}

const mockVideoIdeas: VideoIdea[] = [
  {
    id: "1",
    title: "Why Your AC Runs But Doesn't Cool (5 Hidden Causes)",
    description: "Educational troubleshooting video targeting high-search-volume keywords",
    viralScore: 87,
    status: "new",
    suggestedFormats: ["Long-form", "Shorts"],
  },
  {
    id: "2",
    title: "We Fixed a 15-Year-Old Furnace - Here's What We Found",
    description: "Behind-the-scenes diagnostic video with before/after reveal",
    viralScore: 92,
    status: "scripted",
    suggestedFormats: ["Long-form", "Reel"],
  },
  {
    id: "3",
    title: "HVAC Techs React to DIY Disaster Videos",
    description: "Reaction-style content for entertainment and authority building",
    viralScore: 95,
    status: "new",
    suggestedFormats: ["Long-form", "Clips"],
  },
];

const mockWorkItems: WorkItem[] = [
  {
    id: "yt1",
    title: "Video Script: Emergency AC Repair Guide",
    description: "12-minute educational script with retention hooks every 30 seconds.",
    type: "approval",
    status: "pending",
    priority: "high",
    createdAt: new Date().toISOString(),
    details: "Hook: 'Your AC just died in 100-degree heat. Here's what to do before calling anyone.' Includes 5 chapters with pattern interrupts.",
  },
  {
    id: "yt2",
    title: "Thumbnail Concepts: Furnace Horror Stories",
    description: "3 A/B test thumbnail variations for upcoming video.",
    type: "review",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "yt3",
    title: "Shorts Batch: Quick HVAC Tips (5 videos)",
    description: "Vertical video scripts under 60 seconds each.",
    type: "approval",
    status: "pending",
    priority: "medium",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const AdminAgentYouTube = () => {
  const [videoIdeas, setVideoIdeas] = useState<VideoIdea[]>(mockVideoIdeas);
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
    toast({ title: "Approved", description: "Content approved for production." });
  };

  const handleDeny = (id: string, reason: string) => {
    setWorkItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: "denied" as const } : item
      )
    );
    toast({ title: "Denied", description: reason, variant: "destructive" });
  };

  const handleDiscuss = (id: string) => {
    toast({ title: "Opening Discussion", description: "Use the chat panel to discuss." });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    toast({ title: "Refreshed", description: "YouTube data updated." });
  };

  return (
    <AdminLayout
      title="YouTube Agent"
      subtitle="AI-powered video content strategy and optimization"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Youtube className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">24</p>
                    <p className="text-xs text-muted-foreground">Videos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Eye className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">45.2K</p>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">2.8K</p>
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/20">
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">4:32</p>
                    <p className="text-xs text-muted-foreground">Avg. Watch</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Video Ideas */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Trending Video Ideas
                <Badge variant="secondary" className="ml-auto">{videoIdeas.length} ideas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {videoIdeas.map(idea => (
                  <div key={idea.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={idea.viralScore >= 90 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {idea.viralScore}% viral
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {idea.status}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm">{idea.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>
                        <div className="flex gap-1 mt-2">
                          {idea.suggestedFormats.map(format => (
                            <Badge key={format} variant="outline" className="text-xs">
                              {format}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        <Play className="h-3 w-3 mr-1" />
                        Script
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Work Items */}
          <div className="flex items-center justify-between mb-4">
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
              {workItems.filter(w => w.status === "pending").map(item => (
                <AgentWorkItem
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                  onDiscuss={handleDiscuss}
                />
              ))}
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
            agentName="YouTube"
            agentType="youtube"
            systemPrompt={YOUTUBE_AGENT_PROMPT}
            className="h-[600px] sticky top-4"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAgentYouTube;
