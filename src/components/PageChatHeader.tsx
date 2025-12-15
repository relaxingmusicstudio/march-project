import { useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickAction {
  label: string;
  prompt: string;
}

interface PageChatHeaderProps {
  pageContext: string;
  placeholder?: string;
  quickActions?: QuickAction[];
}

export function PageChatHeader({
  pageContext,
  placeholder = "Ask me anything about this page...",
  quickActions = [],
}: PageChatHeaderProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);
    setIsExpanded(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke("ceo-agent", {
        body: {
          query: message,
          page_context: pageContext,
          stream: false,
        },
      });

      if (error) throw error;

      setResponse(data?.response || data?.message || "I processed your request.");
    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error("Could not get a response. Try again.");
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">Ask questions or get help with this page</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-background"
          disabled={isLoading}
        />
        <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => sendMessage(action.prompt)}
              disabled={isLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {(isExpanded || response) && (
        <div className="mt-3 p-3 rounded-lg bg-background border">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 animate-pulse" />
              <span>Thinking...</span>
            </div>
          ) : response ? (
            <div className="text-sm whitespace-pre-wrap">{response}</div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
