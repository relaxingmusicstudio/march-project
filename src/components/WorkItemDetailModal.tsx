import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Eye,
  FileText,
  BarChart3,
  History,
  Send,
  Loader2,
  Undo2,
  Clock,
  DollarSign,
  Target,
  TrendingUp,
} from "lucide-react";
import type { WorkItem } from "@/components/AgentWorkItem";

interface WorkItemDetailModalProps {
  item: WorkItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (id: string, notes?: string) => void;
  onDeny?: (id: string, reason: string) => void;
  onDiscuss?: (id: string, message: string) => void;
}

interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-accent/20 text-accent",
  urgent: "bg-destructive/20 text-destructive",
};

const WorkItemDetailModal = ({
  item,
  open,
  onOpenChange,
  onApprove,
  onDeny,
  onDiscuss,
}: WorkItemDetailModalProps) => {
  const [denyReason, setDenyReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [discussMessage, setDiscussMessage] = useState("");
  const [discussionHistory, setDiscussionHistory] = useState<AIMessage[]>([]);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");

  if (!item) return null;

  const handleApprove = () => {
    onApprove?.(item.id, approvalNotes);
    onOpenChange(false);
  };

  const handleDeny = () => {
    if (denyReason.trim()) {
      onDeny?.(item.id, denyReason);
      setDenyReason("");
      onOpenChange(false);
    }
  };

  const handleDiscuss = async () => {
    if (!discussMessage.trim()) return;
    
    setIsDiscussing(true);
    const userMessage = discussMessage;
    setDiscussMessage("");
    
    setDiscussionHistory((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    // Simulate AI response (in real implementation, call your AI agent)
    setTimeout(() => {
      setDiscussionHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Based on my analysis of "${item.title}":

${item.type === "approval" ? `This ${item.priority} priority item requires your attention. ` : ""}

**Key Considerations:**
- Current status: ${item.status}
- Created: ${new Date(item.createdAt).toLocaleDateString()}
${item.metadata?.budget ? `- Estimated budget impact: $${item.metadata.budget}` : ""}
${item.metadata?.roi ? `- Projected ROI: ${item.metadata.roi}%` : ""}

**My Recommendation:**
${item.priority === "urgent" || item.priority === "high" 
  ? "I recommend approving this item given its priority level. The potential benefit outweighs the risk."
  : "This is a lower priority item. Consider your current workload before proceeding."}

Would you like me to analyze any specific aspect in more detail?`,
        },
      ]);
      setIsDiscussing(false);
    }, 1500);
  };

  // Mock preview data based on item type
  const getPreviewContent = () => {
    if (item.metadata?.preview) {
      return item.metadata.preview;
    }
    
    return {
      title: item.title,
      description: item.description,
      details: item.details || "No additional details provided.",
    };
  };

  const preview = getPreviewContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl">{item.title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge className={priorityColors[item.priority]}>
                  {item.priority}
                </Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 grid w-fit grid-cols-4">
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="discuss" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Discuss
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden px-6 py-4">
              <TabsContent value="preview" className="h-full mt-0">
                <ScrollArea className="h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Content Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">{preview.title}</h4>
                        <p className="text-muted-foreground">{preview.description}</p>
                      </div>
                      {item.metadata?.image && (
                        <div className="border border-border rounded-lg overflow-hidden">
                          <img
                            src={item.metadata.image}
                            alt="Preview"
                            className="w-full h-auto"
                          />
                        </div>
                      )}
                      {item.metadata?.videoUrl && (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-muted-foreground">Video Preview Available</span>
                        </div>
                      )}
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-card p-4 rounded-lg border">
                          {preview.details}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="details" className="h-full mt-0">
                <ScrollArea className="h-full">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Item Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-muted-foreground">Type</label>
                            <p className="font-medium capitalize">{item.type}</p>
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Status</label>
                            <p className="font-medium capitalize">{item.status}</p>
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Priority</label>
                            <p className="font-medium capitalize">{item.priority}</p>
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Created</label>
                            <p className="font-medium">{new Date(item.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Activity History
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-accent" />
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          {item.status !== "pending" && (
                            <div className="flex items-center gap-3 text-sm">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-muted-foreground capitalize">{item.status}</span>
                              <span>Just now</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="metrics" className="h-full mt-0">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-accent/10 rounded-lg">
                            <DollarSign className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Estimated Cost</p>
                            <p className="text-2xl font-bold">
                              ${item.metadata?.budget || item.metadata?.cost || "N/A"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-500/10 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Projected ROI</p>
                            <p className="text-2xl font-bold">
                              {item.metadata?.roi || item.metadata?.expectedRoi || "N/A"}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Target className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Target Audience</p>
                            <p className="text-lg font-medium">
                              {item.metadata?.audience || "All Customers"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/10 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Expected Reach</p>
                            <p className="text-2xl font-bold">
                              {item.metadata?.reach || "5,000+"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="discuss" className="h-full mt-0 flex flex-col">
                <Card className="flex-1 flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">AI Discussion</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ScrollArea className="flex-1 pr-4 mb-4 max-h-[300px]">
                      <div className="space-y-4">
                        {discussionHistory.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            Ask the AI agent about this item to get recommendations and insights.
                          </p>
                        ) : (
                          discussionHistory.map((msg, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-accent/10 ml-8"
                                  : "bg-muted mr-8"
                              }`}
                            >
                              <p className="text-xs text-muted-foreground mb-1">
                                {msg.role === "user" ? "You" : "AI Agent"}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          ))
                        )}
                        {isDiscussing && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">AI is thinking...</span>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Ask the AI about this item..."
                        value={discussMessage}
                        onChange={(e) => setDiscussMessage(e.target.value)}
                        className="min-h-[60px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleDiscuss();
                          }
                        }}
                      />
                      <Button
                        onClick={handleDiscuss}
                        disabled={isDiscussing || !discussMessage.trim()}
                        size="icon"
                        className="h-auto"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Action Footer */}
        {item.status === "pending" && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Textarea
                  placeholder="Add notes (optional)..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-64 h-10 min-h-[40px] resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const reason = prompt("Enter denial reason:");
                    if (reason) {
                      onDeny?.(item.id, reason);
                      onOpenChange(false);
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WorkItemDetailModal;
