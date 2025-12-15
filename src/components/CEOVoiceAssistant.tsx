import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Loader2,
  Sparkles,
  X
} from "lucide-react";
import Vapi from "@vapi-ai/web";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CEOVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
}

// CEO Assistant ID - this should be configured in Vapi dashboard
const CEO_VAPI_ASSISTANT_ID = "299cdcb8-642d-4728-b434-196724f53ae6";

const CEOVoiceAssistant = ({ isOpen, onClose, onTranscript }: CEOVoiceAssistantProps) => {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize Vapi
  useEffect(() => {
    if (isOpen && !vapi) {
      // Use the public key from environment or hardcoded for demo
      const vapiInstance = new Vapi("6a190658-a99b-44be-a009-94a8110195bb");
      setVapi(vapiInstance);

      vapiInstance.on("call-start", () => {
        console.log("CEO Voice call started");
        setIsConnected(true);
        setIsConnecting(false);
        toast.success("Connected to CEO Assistant");
      });

      vapiInstance.on("call-end", () => {
        console.log("CEO Voice call ended");
        setIsConnected(false);
        setIsConnecting(false);
        setCallDuration(0);
        setVolumeLevel(0);
      });

      vapiInstance.on("speech-start", () => {
        setIsSpeaking(true);
      });

      vapiInstance.on("speech-end", () => {
        setIsSpeaking(false);
      });

      vapiInstance.on("volume-level", (level: number) => {
        setVolumeLevel(level);
      });

      vapiInstance.on("message", async (message: any) => {
        console.log("Vapi message:", message);
        if (message.type === "transcript" && message.transcript) {
          const newEntry = { role: message.role || "user", text: message.transcript };
          setTranscript((prev) => [...prev, newEntry]);
          onTranscript?.(message.transcript, message.role as "user" | "assistant");
          
          // Log user voice input to directives system
          if (message.role === "user") {
            try {
              await supabase.functions.invoke('user-input-logger', {
                body: {
                  action: 'log_input',
                  source: 'ceo_voice',
                  input_type: 'voice',
                  content: message.transcript,
                  classify: true,
                },
              });
            } catch (error) {
              console.error('Failed to log voice input:', error);
            }
          }
        }
        if (message.type === "function-call") {
          console.log("Function call:", message.functionCall);
        }
      });

      vapiInstance.on("error", (error: any) => {
        console.error("Vapi error:", error);
        toast.error("Voice connection error. Please try again.");
        setIsConnecting(false);
      });
    }

    return () => {
      if (vapi) {
        vapi.stop();
      }
    };
  }, [isOpen, onTranscript]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startCall = useCallback(async () => {
    if (!vapi) return;

    setIsConnecting(true);
    setTranscript([]);

    try {
      await vapi.start(CEO_VAPI_ASSISTANT_ID);
    } catch (error) {
      console.error("Failed to start CEO voice call:", error);
      toast.error("Could not connect to CEO Assistant. Check your configuration.");
      setIsConnecting(false);
    }
  }, [vapi]);

  const endCall = useCallback(() => {
    if (vapi) {
      vapi.stop();
    }
  }, [vapi]);

  const toggleMute = useCallback(() => {
    if (vapi) {
      vapi.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [vapi, isMuted]);

  const handleClose = () => {
    if (vapi) {
      vapi.stop();
    }
    setIsConnected(false);
    setIsConnecting(false);
    setTranscript([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-muted"}`} />
            <div>
              <h3 className="text-primary-foreground font-semibold">
                {isConnecting ? "Connecting..." : isConnected ? "CEO Voice Assistant" : "Hey CEO"}
              </h3>
              {isConnected && (
                <p className="text-primary-foreground/80 text-xs">
                  {formatTime(callDuration)} • {isSpeaking ? "Speaking..." : "Listening..."}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
          >
            <X className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        <CardContent className="p-4">
          {!isConnected && !isConnecting ? (
            // Start Screen
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative">
                <Sparkles className="w-10 h-10 text-primary" />
                <div className="absolute inset-0 rounded-full animate-ping bg-primary/10" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Voice-Enabled CEO Assistant
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Ask about performance metrics, leads, revenue, or strategic insights hands-free.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={startCall} 
                  className="w-full gap-2"
                  size="lg"
                >
                  <Phone className="w-5 h-5" />
                  Start Voice Session
                </Button>
                
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline" className="text-xs">
                    "What's my revenue today?"
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    "Show me hot leads"
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    "Weekly summary"
                  </Badge>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                🎤 Ensure microphone access is enabled
              </p>
            </div>
          ) : isConnecting ? (
            // Connecting Screen
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Connecting to CEO Assistant...
              </h3>
              <p className="text-sm text-muted-foreground">
                Preparing voice interface
              </p>
            </div>
          ) : (
            // Active Call Screen
            <div className="space-y-4">
              {/* AI Avatar with Volume Visualization */}
              <div className="flex items-center justify-center">
                <div 
                  className={`relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-all duration-300 ${
                    isSpeaking ? "scale-110 shadow-lg shadow-primary/30" : ""
                  }`}
                  style={{
                    boxShadow: isSpeaking ? `0 0 ${20 + volumeLevel * 30}px rgba(var(--primary), ${0.3 + volumeLevel * 0.4})` : undefined
                  }}
                >
                  <Sparkles className="w-12 h-12 text-primary-foreground" />
                  {isSpeaking && (
                    <div className="absolute inset-0 rounded-full border-4 border-primary-foreground/30 animate-ping" />
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  {isSpeaking ? (
                    <Volume2 className="w-4 h-4 text-accent animate-pulse" />
                  ) : (
                    <Mic className="w-4 h-4 text-primary animate-pulse" />
                  )}
                  <span className="text-sm font-medium">
                    {isSpeaking ? "CEO is responding..." : "Listening for your question..."}
                  </span>
                </div>
              </div>

              {/* Transcript */}
              {transcript.length > 0 && (
                <ScrollArea className="h-32 rounded-lg bg-muted/50 p-3" ref={scrollRef}>
                  <div className="space-y-2">
                    {transcript.slice(-6).map((entry, i) => (
                      <p 
                        key={i} 
                        className={`text-sm ${
                          entry.role === "assistant" 
                            ? "text-primary font-medium" 
                            : "text-foreground"
                        }`}
                      >
                        <span className="text-muted-foreground">
                          {entry.role === "assistant" ? "CEO: " : "You: "}
                        </span>
                        {entry.text}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="icon"
                  className="w-12 h-12 rounded-full"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="icon"
                  className="w-14 h-14 rounded-full shadow-lg"
                  onClick={endCall}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CEOVoiceAssistant;
