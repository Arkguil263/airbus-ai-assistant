import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import { RealtimeVoiceClient } from '@/utils/RealtimeVoice';

interface VoiceAgentProps {
  aircraftModel?: string;
  onTranscript?: (text: string) => void;
}

export default function VoiceAgent({ aircraftModel = 'A320', onTranscript }: VoiceAgentProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const { toast } = useToast();
  
  const clientRef = useRef<RealtimeVoiceClient | null>(null);

  useEffect(() => {
    // Initialize the client
    clientRef.current = new RealtimeVoiceClient();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  const handleConnect = async () => {
    if (!clientRef.current) return;

    setIsConnecting(true);
    try {
      await clientRef.current.connect({
        aircraftModel,
        onTranscript: (text) => {
          setTranscript(text);
          onTranscript?.(text);
        },
        onConnected: () => {
          setIsConnected(true);
          setIsConnecting(false);
          toast({
            title: "Voice Agent Connected",
            description: `You can now speak with the ${aircraftModel} AI assistant`,
          });
        },
        onDisconnected: () => {
          setIsConnected(false);
          setIsConnecting(false);
          setTranscript('');
        },
        onError: (error) => {
          setIsConnecting(false);
          toast({
            title: "Connection Error",
            description: error,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      setIsConnecting(false);
      toast({
        title: "Failed to Connect",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setIsConnected(false);
      setTranscript('');
      toast({
        title: "Voice Agent Disconnected",
        description: "Voice session ended",
      });
    }
  };

  const handleMuteToggle = () => {
    if (clientRef.current) {
      if (isMuted) {
        clientRef.current.unmute();
      } else {
        clientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  return (
    <Card className="p-6 bg-card border border-border">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Voice Agent - {aircraftModel}
          </h3>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMuteToggle}
                className="flex items-center gap-2"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
            )}
            
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Phone className="h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Connect Voice'}
              </Button>
            ) : (
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Connected - Speak naturally to the AI assistant
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mic className="h-4 w-4" />
              Microphone active - AI can hear you and search documents
            </div>
          </div>
        )}

        {transcript && (
          <div className="mt-4">
            <div className="text-sm font-medium text-foreground mb-2">Live Transcript:</div>
            <div className="p-3 bg-muted rounded-lg border text-sm">
              {transcript}
            </div>
          </div>
        )}

        {!isConnected && !isConnecting && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Click "Connect Voice" to start a voice conversation with the AI assistant.</p>
            <p className="text-xs text-muted-foreground">
              The assistant can help with {aircraftModel} systems, procedures, and documentation.
              It will search the document vector store when needed for accurate technical information.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}