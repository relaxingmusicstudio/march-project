import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  Send, 
  Loader2, 
  Bot, 
  User,
  Sparkles,
  Mic,
  DollarSign,
  Users,
  Zap,
  Clock,
  TrendingUp,
  CheckCircle2,
  FileText,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import CEOVoiceAssistant from "@/components/CEOVoiceAssistant";
import { SummaryWidget } from "@/components/ceo/SummaryWidget";
import { useClickThrough } from "@/hooks/useClickThrough";
import ErrorBoundary from "@/components/ErrorBoundary";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DashboardMetrics {
  revenue: number;
  revenueChange: number;
  hotLeads: number;
  hotLeadsChange: number;
  pipelineValue: number;
  pipelineChange: number;
  pendingApprovals: number;
  conversionRate: number;
}

const QUICK_PROMPTS = [
  { label: "Daily Brief", query: "Give me my morning brief with key metrics and recommended actions" },
  { label: "Hot Leads", query: "Show me all hot leads that need attention today" },
  { label: "AI Activity", query: "Summarize all AI activity from the last 24 hours" },
  { label: "Revenue", query: "How's revenue tracking this month vs targets?" },
];

export default function AICEODashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { navigateToDetail } = useClickThrough();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    fetchMetrics();
    
    // Listen for workspace refresh events
    const handleRefresh = () => fetchMetrics();
    window.addEventListener("workspace-refresh", handleRefresh);
    return () => window.removeEventListener("workspace-refresh", handleRefresh);
  }, []);

  // Real-time subscription for metrics updates
  useEffect(() => {
    const channel = supabase
      .channel("metrics-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => fetchMetrics()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content" },
        () => fetchMetrics()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deal_pipeline" },
        () => fetchMetrics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [leadsRes, contentRes, pipelineRes, leadsLastWeek] = await Promise.all([
        supabase.from("leads").select("*").gte("created_at", yesterday.toISOString()),
        supabase.from("content").select("*").eq("status", "pending"),
        supabase.from("deal_pipeline").select("*"),
        supabase.from("leads").select("*").gte("created_at", lastWeek.toISOString()).lt("created_at", yesterday.toISOString()),
      ]);

      const leads = leadsRes.data || [];
      const content = contentRes.data || [];
      const pipeline = pipelineRes.data || [];
      const leadsLast = leadsLastWeek.data || [];

      const hotLeads = leads.filter(l => l.lead_score >= 70 || l.lead_temperature === "hot");
      const hotLeadsLast = leadsLast.filter(l => l.lead_score >= 70 || l.lead_temperature === "hot");
      const wonLeads = leads.filter(l => l.status === "won" || l.status === "converted");
      const revenue = wonLeads.reduce((sum, l) => sum + (l.revenue_value || 0), 0);
      const pipelineValue = pipeline.reduce((sum, d) => sum + (d.value || 0), 0);

      setMetrics({
        revenue,
        revenueChange: 12.5,
        hotLeads: hotLeads.length,
        hotLeadsChange: hotLeads.length - hotLeadsLast.length,
        pipelineValue,
        pipelineChange: 8.3,
        pendingApprovals: content.length,
        conversionRate: leads.length > 0 ? (wonLeads.length / leads.length) * 100 : 0,
      });

      // Auto-generate greeting if first load
      if (messages.length === 0) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        const briefMessage: Message = {
          role: "assistant",
          content: `${greeting}, CEO! 👋\n\n**Today's Snapshot:**\n• Revenue: $${revenue.toLocaleString()}\n• ${hotLeads.length} hot leads ready to close\n• ${content.length} items pending approval\n• Pipeline: $${pipelineValue.toLocaleString()}\n\nHow can I help you today?`,
          timestamp: new Date(),
        };
        setMessages([briefMessage]);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const sendMessage = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ceo-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          query,
          timeRange: "7d",
          conversationHistory: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Rate limited. Please try again in a moment.");
          return;
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamingContent(fullContent);
            }
          } catch {}
        }
      }

      const assistantMessage: Message = { role: "assistant", content: fullContent, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error) {
      console.error("CEO Agent error:", error);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
      .replace(/\n/g, "<br/>");
  };

  return (
    <ErrorBoundary>
      <div className="container py-6 space-y-6">
        <CEOVoiceAssistant
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          onTranscript={(text, role) => {
            setMessages(prev => [...prev, { role, content: text, timestamp: new Date() }]);
          }}
        />

        {/* Summary Widgets - Click Through to Command Center */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryWidget
            title="Today's Revenue"
            value={metrics?.revenue || 0}
            icon={DollarSign}
            entity="crm"
            filter={{ status: "converted", date: "today" }}
            format="currency"
            isLoading={isLoadingMetrics}
            trend={metrics?.revenueChange && metrics.revenueChange > 0 ? "up" : "down"}
            trendLabel={`${metrics?.revenueChange?.toFixed(1)}%`}
          />
          <SummaryWidget
            title="Hot Leads"
            value={metrics?.hotLeads || 0}
            icon={Zap}
            entity="crm"
            filter={{ filter: "hot" }}
            isLoading={isLoadingMetrics}
            badge={metrics?.hotLeads && metrics.hotLeads > 0 ? "Action needed" : undefined}
            badgeVariant="destructive"
          />
          <SummaryWidget
            title="Pipeline Value"
            value={metrics?.pipelineValue || 0}
            icon={Target}
            entity="pipeline"
            format="currency"
            isLoading={isLoadingMetrics}
            trend="up"
            trendLabel={`${metrics?.pipelineChange?.toFixed(1)}%`}
          />
          <SummaryWidget
            title="Pending Approvals"
            value={metrics?.pendingApprovals || 0}
            icon={Clock}
            entity="approvals"
            isLoading={isLoadingMetrics}
            badge={metrics?.pendingApprovals && metrics.pendingApprovals > 5 ? "Review" : undefined}
          />
        </div>

        {/* Main Chat Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 h-[calc(100vh-380px)] flex flex-col">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  AI CEO Assistant
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsVoiceOpen(true)}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Badge variant="secondary" className="text-xs">Connected</Badge>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              {/* Quick Prompts */}
              {messages.length <= 1 && (
                <div className="p-4 border-b bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt.label}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => sendMessage(prompt.query)}
                      >
                        {prompt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                        />
                      </div>
                      {msg.role === "user" && (
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted">
                        <div
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: formatContent(streamingContent) }}
                        />
                      </div>
                    </div>
                  )}

                  {isLoading && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      </div>
                      <div className="rounded-lg px-4 py-2 bg-muted">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Analyzing your business...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(input);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your business..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Quick Navigation Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Command Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigateToDetail("crm")}
              >
                <Users className="h-4 w-4 mr-2" />
                CRM & Leads
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigateToDetail("pipeline")}
              >
                <Target className="h-4 w-4 mr-2" />
                Sales Pipeline
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigateToDetail("content")}
              >
                <FileText className="h-4 w-4 mr-2" />
                Content
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigateToDetail("approvals")}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approvals
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigateToDetail("vault")}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Knowledge Vault
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
