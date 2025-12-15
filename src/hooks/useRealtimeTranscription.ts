import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
}

interface UseRealtimeTranscriptionReturn {
  isConnected: boolean;
  isListening: boolean;
  partialTranscript: string;
  committedTranscripts: TranscriptEntry[];
  startListening: () => Promise<void>;
  stopListening: () => void;
  error: string | null;
}

export const useRealtimeTranscription = (): UseRealtimeTranscriptionReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [committedTranscripts, setCommittedTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    setError(null);

    try {
      // Get token from edge function
      const { data, error: tokenError } = await supabase.functions.invoke('elevenlabs-scribe-token');

      if (tokenError || !data?.token) {
        throw new Error(tokenError?.message || 'Failed to get transcription token');
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // Connect to ElevenLabs WebSocket
      const ws = new WebSocket(`wss://api.elevenlabs.io/v1/scribe/realtime?token=${data.token}`);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('Transcription WebSocket connected');
        setIsConnected(true);
        setIsListening(true);

        // Send initial configuration
        ws.send(JSON.stringify({
          type: 'configure',
          model_id: 'scribe_v2_realtime',
          sample_rate: 16000,
          commit_strategy: 'vad',
        }));

        // Start MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const arrayBuffer = await event.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            ws.send(JSON.stringify({
              type: 'audio',
              audio: base64,
            }));
          }
        };

        mediaRecorder.start(100); // Send audio every 100ms
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'partial_transcript') {
            setPartialTranscript(data.text || '');
          } else if (data.type === 'committed_transcript') {
            const entry: TranscriptEntry = {
              id: crypto.randomUUID(),
              text: data.text || '',
              timestamp: Date.now(),
            };
            setCommittedTranscripts(prev => [...prev, entry]);
            setPartialTranscript('');
          }
        } catch (e) {
          console.error('Error parsing transcription message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('Transcription WebSocket error:', event);
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('Transcription WebSocket closed');
        setIsConnected(false);
        setIsListening(false);
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Transcription error:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setPartialTranscript('');
  }, []);

  return {
    isConnected,
    isListening,
    partialTranscript,
    committedTranscripts,
    startListening,
    stopListening,
    error,
  };
};
