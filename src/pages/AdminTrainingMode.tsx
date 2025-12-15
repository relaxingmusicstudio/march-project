import { useState, useRef, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Mic, MicOff, Brain, Save, Trash2, Clock, Sparkles, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TrainingSession {
  session_id: string;
  started_at: string;
  transcript_count: number;
}

interface TrainingStats {
  total_decisions: number;
  patterns_detected: number;
  sessions_completed: number;
  average_confidence: number;
  recent_decisions: Array<{
    id: string;
    created_at: string;
    decision_type: string;
    confidence: number;
  }>;
}

interface TranscriptEntry {
  id: string;
  content: string;
  type: 'voice' | 'action' | 'decision';
  timestamp: string;
  processed: boolean;
}

const AdminTrainingMode = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [decisionType, setDecisionType] = useState("general");
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load training stats on mount
  useEffect(() => {
    loadTrainingStats();
  }, []);

  const loadTrainingStats = async () => {
    try {
      setIsLoadingStats(true);
      const { data, error } = await supabase.functions.invoke('ceo-training', {
        body: { action: 'get_training_stats' }
      });
      
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Failed to load training stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const startSession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ceo-training', {
        body: { action: 'start_session' }
      });
      
      if (error) throw error;
      
      setCurrentSession({
        session_id: data.session_id,
        started_at: data.started_at,
        transcript_count: 0
      });
      setTranscripts([]);
      toast.success("Training session started");
    } catch (err) {
      toast.error("Failed to start session");
      console.error(err);
    }
  };

  const endSession = async () => {
    if (!currentSession) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('ceo-training', {
        body: { action: 'end_session', session_id: currentSession.session_id }
      });
      
      if (error) throw error;
      
      toast.success(`Session ended: ${data.decisions_processed} decisions processed`);
      setCurrentSession(null);
      setTranscripts([]);
      loadTrainingStats();
    } catch (err) {
      toast.error("Failed to end session");
      console.error(err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        // Transcribe audio using ElevenLabs
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started - speak your decision");
    } catch (err) {
      toast.error("Failed to access microphone");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Create form data for transcription
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-transcribe', {
        body: formData
      });
      
      if (error) throw error;
      
      const transcribedText = data?.text || '';
      if (transcribedText) {
        setCurrentTranscript(transcribedText);
        addTranscript(transcribedText, 'voice');
      }
    } catch (err) {
      console.error('Transcription failed:', err);
      toast.error("Transcription failed - you can type your decision instead");
    } finally {
      setIsProcessing(false);
    }
  };

  const addTranscript = (content: string, type: 'voice' | 'action' | 'decision') => {
    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      content,
      type,
      timestamp: new Date().toISOString(),
      processed: false
    };
    
    setTranscripts(prev => [...prev, entry]);
    
    // Add to session on backend
    if (currentSession) {
      supabase.functions.invoke('ceo-training', {
        body: {
          action: 'add_transcript',
          session_id: currentSession.session_id,
          transcript: content,
          type
        }
      });
    }
  };

  const processDecision = async (content: string) => {
    if (!content.trim()) {
      toast.error("Please enter or record a decision first");
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('ceo-training', {
        body: {
          action: 'process_decision',
          session_id: currentSession?.session_id,
          transcript: content,
          decision_type: decisionType,
          context: { source: 'training_mode' }
        }
      });
      
      if (error) throw error;
      
      // Mark as processed
      addTranscript(content, 'decision');
      setCurrentTranscript("");
      
      toast.success("Decision processed and stored for learning", {
        description: `Type: ${data.decision?.decision_type || decisionType}`
      });
      
      loadTrainingStats();
    } catch (err) {
      toast.error("Failed to process decision");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (startTime: string) => {
    const diff = Date.now() - new Date(startTime).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AdminLayout title="CEO Training Mode" subtitle="Train the AI to think and respond like you">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              CEO Training Mode
            </h1>
            <p className="text-muted-foreground mt-1">
              Train the AI to think and respond like you by recording your decisions
            </p>
          </div>
          
          {!currentSession ? (
            <Button onClick={startSession} size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Start Training Session
            </Button>
          ) : (
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                <Clock className="h-4 w-4 mr-2" />
                {formatDuration(currentSession.started_at)}
              </Badge>
              <Button onClick={endSession} variant="outline" size="lg">
                End Session
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Decisions Learned</p>
                  <p className="text-3xl font-bold">{stats?.total_decisions || 0}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Patterns Detected</p>
                  <p className="text-3xl font-bold">{stats?.patterns_detected || 0}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sessions Completed</p>
                  <p className="text-3xl font-bold">{stats?.sessions_completed || 0}</p>
                </div>
                <Brain className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Confidence</p>
                  <p className="text-3xl font-bold">{((stats?.average_confidence || 0) * 100).toFixed(0)}%</p>
                </div>
                <Sparkles className="h-10 w-10 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Training Interface */}
        {currentSession && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recording / Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Record Decision
                </CardTitle>
                <CardDescription>
                  Speak or type your decision-making process as you work
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Voice Recording Button */}
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className={`w-32 h-32 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                  >
                    {isRecording ? (
                      <MicOff className="h-12 w-12" />
                    ) : (
                      <Mic className="h-12 w-12" />
                    )}
                  </Button>
                </div>
                
                <p className="text-center text-sm text-muted-foreground">
                  {isRecording ? "Recording... Click to stop" : "Click to start recording"}
                </p>

                {/* Decision Type Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Decision Type</label>
                  <Select value={decisionType} onValueChange={setDecisionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Decision</SelectItem>
                      <SelectItem value="pricing">Pricing Strategy</SelectItem>
                      <SelectItem value="lead_qualification">Lead Qualification</SelectItem>
                      <SelectItem value="objection_handling">Objection Handling</SelectItem>
                      <SelectItem value="hiring">Hiring/Team</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="customer_service">Customer Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Text Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Or type your decision</label>
                  <Textarea
                    placeholder="Describe your decision and reasoning..."
                    value={currentTranscript}
                    onChange={(e) => setCurrentTranscript(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Process Button */}
                <Button
                  className="w-full gap-2"
                  onClick={() => processDecision(currentTranscript)}
                  disabled={isProcessing || !currentTranscript.trim()}
                >
                  {isProcessing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Decision
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Session Transcripts */}
            <Card>
              <CardHeader>
                <CardTitle>Session Transcripts</CardTitle>
                <CardDescription>
                  {transcripts.length} entries this session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {transcripts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No transcripts yet</p>
                      <p className="text-sm">Start recording or typing to add decisions</p>
                    </div>
                  ) : (
                    transcripts.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={entry.type === 'decision' ? 'default' : 'secondary'}>
                                {entry.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm">{entry.content}</p>
                          </div>
                          {entry.processed && (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Decisions */}
        {!currentSession && stats?.recent_decisions && stats.recent_decisions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Learned Decisions</CardTitle>
              <CardDescription>
                The AI is learning from these decisions to mimic your style
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recent_decisions.map((decision) => (
                  <div
                    key={decision.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge>{decision.decision_type || 'general'}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(decision.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={decision.confidence * 100} className="w-24" />
                      <span className="text-sm">{(decision.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        {!currentSession && (
          <Card>
            <CardHeader>
              <CardTitle>How CEO Training Mode Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Mic className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Record Decisions</h3>
                  <p className="text-sm text-muted-foreground">
                    As you work, speak or type your decisions and reasoning. Explain why you made each choice.
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">2. AI Analyzes</h3>
                  <p className="text-sm text-muted-foreground">
                    Claude analyzes your decisions to understand your reasoning patterns, priorities, and style.
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">3. AI Mimics You</h3>
                  <p className="text-sm text-muted-foreground">
                    Over time, the CEO Agent learns to respond with your decision-making style and priorities.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminTrainingMode;
