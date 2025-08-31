import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';


interface VoiceEnabledMessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  aircraftModel: string;
  assistantId?: string;
  onVoiceMessage?: (message: { role: 'user' | 'assistant'; content: string; isVoice?: boolean }) => void;
}

interface TranscriptMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const VoiceEnabledMessageInput = ({ 
  onSendMessage, 
  isLoading, 
  disabled, 
  placeholder,
  aircraftModel,
  assistantId,
  onVoiceMessage 
}: VoiceEnabledMessageInputProps) => {
  const [message, setMessage] = useState('');
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [connecting, setConnecting] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Voice connection refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Auto-resize textarea based on content
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
      textarea.style.height = `${newHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const connectVoice = async () => {
    if (voiceConnected || connecting) return;
    setConnecting(true);

    try {
      // Create voice instructions that include aircraft model context
      const instructions = `You are a helpful voice agent for ${aircraftModel} aircraft documentation. 
        You have access to ${aircraftModel} manuals and technical documentation. 
        Keep replies concise and friendly. Focus on ${aircraftModel}-specific information when answering questions.`;
        
      // Use aircraft-specific realtime session endpoint
      const sessionEndpoint = aircraftModel === 'A330' ? 'realtime-session-a330' : 'realtime-session';
      const { data, error } = await supabase.functions.invoke(sessionEndpoint, {
        body: { instructions }
      });

      if (error || !data?.client_secret) {
        throw new Error(error?.message || 'Failed to establish voice connection');
      }

      const clientSecret = data.client_secret;

      // Set up WebRTC
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Play remote audio
      const audio = new Audio();
      audio.autoplay = true;
      remoteAudioRef.current = audio;
      
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
      };

      // Data channel for control messages
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      
      dc.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          
          // Handle voice response completion - add to main chat
          if (event.type === 'response.audio_transcript.done') {
            if (event.transcript && event.transcript.trim()) {
              console.log('Voice response received:', event.transcript);
              // Add AI response to main chat
              onVoiceMessage?.({ 
                role: 'assistant', 
                content: event.transcript, 
                isVoice: true 
              });
            }
          } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
            // Handle user speech transcription - add to main chat and send to vector search
            if (event.transcript && event.transcript.trim()) {
              console.log('User speech transcribed:', event.transcript);
              
              // Add user message to main chat
              onVoiceMessage?.({ 
                role: 'user', 
                content: event.transcript, 
                isVoice: true 
              });
              
              // Call vector search function instead of regular chat
              handleVectorSearch(event.transcript);
            }
          }
        } catch (error) {
          console.error('Error parsing WebRTC event:', error);
        }
      };

      // Add microphone
      const ms = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      ms.getTracks().forEach((t) => pc.addTrack(t, ms));
      micStreamRef.current = ms;

      // Create an SDP offer for OpenAI
      const offer = await pc.createOffer({ 
        offerToReceiveAudio: true, 
        offerToReceiveVideo: false 
      });
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI Realtime with the ephemeral key
      const sdpResp = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp!,
      });

      if (!sdpResp.ok) {
        throw new Error(`Voice setup failed: ${await sdpResp.text()}`);
      }

      const answerSDP = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

      setVoiceConnected(true);
      
      toast({
        title: "Voice Connected",
        description: `Voice chat enabled for ${aircraftModel}. You can now speak your questions.`,
      });

    } catch (error) {
      console.error('Voice connection error:', error);
      toast({
        title: "Voice Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectVoice = async () => {
    if (!voiceConnected) return;
    
    setVoiceConnected(false);
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    
    dcRef.current = null;
    pcRef.current = null;
    micStreamRef.current = null;
    
    toast({
      title: "Voice Disconnected",
      description: "Voice chat has been disabled.",
    });
  };

  const toggleMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  // New function to handle vector search
  const handleVectorSearch = async (question: string) => {
    try {
      console.log('Calling vector search for:', question);
      
      // Use aircraft-specific vector search endpoint
      const vectorSearchEndpoint = aircraftModel === 'A330' ? 'vector-search-a330' : 'vector-search';
      const { data, error } = await supabase.functions.invoke(vectorSearchEndpoint, {
        body: { 
          question: question,
          aircraftModel: aircraftModel 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Add the response to chat as an assistant message
      if (data?.answer) {
        setTimeout(() => {
          onVoiceMessage?.({ 
            role: 'assistant', 
            content: data.answer, 
            isVoice: true 
          });
        }, 500);
      }

    } catch (error) {
      console.error('Vector search error:', error);
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectVoice();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Realtime Voice Assistant Button */}
      <div className="px-4">
        {!voiceConnected ? (
          <Button 
            type="button"
            onClick={connectVoice} 
            disabled={connecting || disabled}
            variant="outline"
            className="w-full transition-all duration-200 hover:scale-[1.02] disabled:scale-100"
          >
            <Mic className="h-4 w-4 mr-2" />
            {connecting ? "Connecting..." : "Realtime Voice Assistant"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={toggleMic}
              variant={micEnabled ? "default" : "secondary"}
              className="flex-1 transition-all duration-200 hover:scale-[1.02]"
            >
              {micEnabled ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
              {micEnabled ? "Voice Active" : "Voice Muted"}
            </Button>
            <Button
              type="button"
              onClick={disconnectVoice}
              variant="destructive"
              className="transition-all duration-200 hover:scale-[1.02]"
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-3 p-4 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || (disabled ? "Select a conversation to start chatting" : `Message ${aircraftModel} AI...`)}
            disabled={disabled || isLoading}
            className="min-h-[40px] max-h-[120px] resize-none overflow-y-hidden py-3 text-base leading-6 bg-background border-input focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            rows={1}
          />
        </div>
        
        {/* Send Button */}
        <Button 
          type="submit" 
          disabled={!message.trim() || isLoading || disabled}
          size="icon"
          className="h-[44px] w-[44px] shrink-0 rounded-lg transition-all duration-200 hover:scale-105 disabled:scale-100"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default VoiceEnabledMessageInput;