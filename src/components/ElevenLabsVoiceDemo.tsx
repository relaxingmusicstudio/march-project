import { useState, useCallback, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ElevenLabsVoiceDemoProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
}

export const ElevenLabsVoiceDemo = ({ isOpen, onClose, agentId }: ElevenLabsVoiceDemoProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<Array<{ role: string; text: string }>>([]);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      setIsConnecting(false);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setCallDuration(0);
    },
    onMessage: (message) => {
      console.log('Message:', message);
      const msg = message as unknown as Record<string, unknown>;
      if (msg.type === 'user_transcript') {
        const event = msg.user_transcription_event as Record<string, unknown> | undefined;
        const transcript = event?.user_transcript as string | undefined;
        if (transcript) {
          setTranscripts(prev => [...prev, { role: 'user', text: transcript }]);
        }
      } else if (msg.type === 'agent_response') {
        const event = msg.agent_response_event as Record<string, unknown> | undefined;
        const response = event?.agent_response as string | undefined;
        if (response) {
          setTranscripts(prev => [...prev, { role: 'agent', text: response }]);
        }
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      toast.error('Voice connection error. Please try again.');
      setIsConnecting(false);
    },
  });

  // Call duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (conversation.status === 'connected') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [conversation.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = useCallback(async () => {
    if (!agentId) {
      toast.error('Agent ID not configured. Please set up your ElevenLabs agent.');
      return;
    }

    setIsConnecting(true);
    setTranscripts([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { agentId },
      });

      if (error || !data?.token) {
        throw new Error(error?.message || 'Failed to get conversation token');
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: 'webrtc',
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start voice demo');
      setIsConnecting(false);
    }
  }, [conversation, agentId]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    // Note: ElevenLabs SDK handles muting internally
  }, [isMuted]);

  const handleClose = useCallback(() => {
    if (conversation.status === 'connected') {
      conversation.endSession();
    }
    onClose();
  }, [conversation, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 p-6 bg-background border-border">
        <div className="flex flex-col items-center space-y-6">
          {/* Header */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-foreground">AI Voice Demo</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {conversation.status === 'connected' 
                ? `Call in progress • ${formatTime(callDuration)}`
                : 'Experience our AI dispatcher'}
            </p>
          </div>

          {/* Avatar with speaking indicator */}
          <div className="relative">
            <div className={`w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ${
              conversation.isSpeaking ? 'ring-4 ring-primary ring-opacity-50 animate-pulse' : ''
            }`}>
              <Volume2 className={`w-10 h-10 ${conversation.isSpeaking ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            {conversation.isSpeaking && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                Speaking
              </div>
            )}
          </div>

          {/* Transcript */}
          {transcripts.length > 0 && (
            <div className="w-full max-h-40 overflow-y-auto bg-muted/50 rounded-lg p-3 space-y-2">
              {transcripts.slice(-5).map((t, i) => (
                <div key={i} className={`text-sm ${t.role === 'user' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                  <span className="font-semibold">{t.role === 'user' ? 'You' : 'AI'}:</span> {t.text}
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            {conversation.status === 'disconnected' ? (
              <Button 
                onClick={startCall} 
                disabled={isConnecting}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Phone className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : 'Start Demo'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleMute}
                  className={isMuted ? 'bg-destructive/10 text-destructive' : ''}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={endCall}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </Button>
              </>
            )}
          </div>

          {/* Close button */}
          <Button variant="ghost" onClick={handleClose} className="text-muted-foreground">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};
