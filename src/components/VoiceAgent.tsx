import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function VoiceAgent() {
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const connect = async () => {
    if (connected || connecting) return;
    setConnecting(true);

    try {
      // Get ephemeral client_secret from Supabase
      const instructions = "You are a helpful voice agent for aircraft documentation. Keep replies concise and friendly.";
        
      const { data, error } = await supabase.functions.invoke('realtime-session', {
        body: { 
          instructions 
        }
      });

      if (error || !data?.client_secret) {
        throw new Error(error?.message || 'Failed to mint ephemeral key');
      }

      const clientSecret = data.client_secret.value;

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
        throw new Error(`WebRTC setup failed: ${await sdpResp.text()}`);
      }

      const answerSDP = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

      setConnected(true);
      
      toast({
        title: "Connected",
        description: "Voice agent is ready. You can now speak with the AI.",
      });

    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!connected) return;
    
    setConnected(false);
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    
    dcRef.current = null;
    pcRef.current = null;
    micStreamRef.current = null;
    
    toast({
      title: "Disconnected",
      description: "Voice agent session ended.",
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

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <Mic className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Voice Agent</h2>
          <p className="text-muted-foreground">
            {connected 
              ? "Connected! Start speaking to interact with the AI."
              : "Connect to start a voice conversation with the AI assistant."
            }
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {!connected ? (
            <Button 
              onClick={connect} 
              disabled={connecting}
              size="lg"
              className="flex items-center gap-2"
            >
              <Mic className="h-5 w-5" />
              {connecting ? "Connecting..." : "Connect Voice Agent"}
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={toggleMic}
                variant={micEnabled ? "default" : "secondary"}
                size="lg"
                className="flex items-center gap-2"
              >
                {micEnabled ? (
                  <>
                    <Mic className="h-5 w-5" />
                    Microphone On
                  </>
                ) : (
                  <>
                    <MicOff className="h-5 w-5" />
                    Microphone Off
                  </>
                )}
              </Button>
              
              <Button 
                onClick={disconnect} 
                variant="destructive"
                size="lg"
                className="flex items-center gap-2"
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>

        {connected && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Voice agent is listening. Speak naturally to ask questions or have a conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}