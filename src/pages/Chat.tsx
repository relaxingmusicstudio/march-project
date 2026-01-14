import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type HealthPayload = {
  ok?: boolean;
  service?: string;
  kernelVersion?: string;
  ts?: string;
  status?: string;
};

type ChatPayload = {
  ok?: boolean;
  reply?: string;
  needsConfig?: boolean;
  model?: string;
  error?: string;
};

export default function Chat() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health", { method: "GET" });
        const text = await response.text();
        let payload: HealthPayload | null = null;
        try {
          payload = JSON.parse(text) as HealthPayload;
        } catch {
          payload = null;
        }
        if (!mounted) return;
        if (!payload || payload.ok !== true) {
          setHealthError("health_not_ok");
          return;
        }
        setHealth(payload);
      } catch {
        if (!mounted) return;
        setHealthError("health_unreachable");
      }
    };
    loadHealth();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    setChatError(null);
    setReply(null);
    setNeedsConfig(false);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const text = await response.text();
      let payload: ChatPayload | null = null;
      try {
        payload = JSON.parse(text) as ChatPayload;
      } catch {
        payload = null;
      }
      if (!payload) {
        setChatError("chat_not_json");
        return;
      }
      if (payload.ok === false) {
        setChatError(payload.error || "chat_error");
        return;
      }
      setReply(payload.reply || "");
      setNeedsConfig(Boolean(payload.needsConfig));
    } catch {
      setChatError("chat_unreachable");
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(health?.ok) && Boolean(message.trim()) && !sending;

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Chat</h1>
          <p className="text-sm text-muted-foreground">AI not connected yet.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {health ? (
              <>
                <div>Service: {health.service ?? "unknown"}</div>
                <div>Kernel: {health.kernelVersion ?? "unknown"}</div>
                <div>Checked: {health.ts ?? "unknown"}</div>
              </>
            ) : (
              <div>Checking /api/health...</div>
            )}
            {healthError && <div className="text-destructive">Health error: {healthError}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send a message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type your message..."
              className="min-h-[120px]"
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleSend} disabled={!canSend}>
                {sending ? "Sending..." : "Send"}
              </Button>
              {!health?.ok && <span className="text-xs text-muted-foreground">Waiting for health check...</span>}
            </div>
            {needsConfig && (
              <div className="text-xs text-amber-600">
                AI not configured. Add OPENAI_API_KEY to enable real responses.
              </div>
            )}
            {chatError && <div className="text-sm text-destructive">Chat error: {chatError}</div>}
            {reply && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
                {reply}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
