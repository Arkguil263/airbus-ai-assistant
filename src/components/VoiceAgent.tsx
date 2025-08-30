import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Phone, PhoneOff, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function VoiceAgent() {
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [question, setQuestion] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const connect = async () => {
    if (connected || connecting) return;
    setConnecting(true);

    try {
      // 1) Get ephemeral client_secret from Supabase
      const { data, error } = await supabase.functions.invoke('realtime-session', {
        body: { 
          instructions: "You are a helpful voice agent for aircraft documentation. Keep replies concise and friendly." 
        }
      });

      if (error || !data?.client_secret) {
        throw new Error(error?.message || 'Failed to mint ephemeral key');
      }

      const clientSecret = data.client_secret;

      // 2) Set up WebRTC
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
        // Handle WebRTC events if needed
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

      // 3) Create an SDP offer for OpenAI
      const offer = await pc.createOffer({ 
        offerToReceiveAudio: true, 
        offerToReceiveVideo: false 
      });
      await pc.setLocalDescription(offer);

      // 4) Send offer to OpenAI Realtime with the ephemeral key
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
        description: "Voice agent is ready. You can now speak or type questions.",
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

  const askDocs = async (questionText: string) => {
    if (!questionText.trim()) return;

    try {
      // 1) Get grounded answer from vector store via backend
      const { data, error } = await supabase.functions.invoke('ask-docs', {
        body: { question: questionText }
      });

      if (error) {
        throw new Error(error.message);
      }

      const answer = data?.answer || 'No answer found.';

      // 2) Tell Realtime model to SPEAK this text
      if (dcRef.current && dcRef.current.readyState === 'open') {
        const payload = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "assistant",
            content: [
              {
                type: "text",
                text: answer
              }
            ]
          }
        };
        
        dcRef.current.send(JSON.stringify(payload));
        
        // Trigger response generation
        dcRef.current.send(JSON.stringify({
          type: "response.create"
        }));
      } else {
        console.log('Data channel not ready');
      }

    } catch (error) {
      console.error('Ask docs error:', error);
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAskDocs = () => {
    if (question.trim()) {
      askDocs(question);
      setQuestion("");
    }
  };

  const testConnections = async () => {
    setTesting(true);
    let realtimeOk = false;
    let vectorStoreOk = false;

    try {
      // Test 1: Realtime session endpoint
      console.log('Testing realtime-session endpoint...');
      const { data: realtimeData, error: realtimeError } = await supabase.functions.invoke('realtime-session', {
        body: { 
          instructions: "Test connection for voice agent" 
        }
      });

      if (realtimeError || !realtimeData?.client_secret) {
        console.error('Realtime test failed:', realtimeError);
      } else {
        console.log('Realtime test passed:', realtimeData);
        realtimeOk = true;
      }

      // Test 2: Vector store endpoint
      console.log('Testing ask-docs endpoint...');
      const { data: docsData, error: docsError } = await supabase.functions.invoke('ask-docs', {
        body: { question: "Test connection to vector store" }
      });

      if (docsError || !docsData?.answer) {
        console.error('Vector store test failed:', docsError);
      } else {
        console.log('Vector store test passed:', docsData);
        vectorStoreOk = true;
      }

      // Show results
      const results = [
        `Realtime API: ${realtimeOk ? '✅ Connected' : '❌ Failed'}`,
        `Vector Store: ${vectorStoreOk ? '✅ Connected' : '❌ Failed'}`
      ].join('\n');

      toast({
        title: "API Connection Test",
        description: results,
        variant: realtimeOk && vectorStoreOk ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskDocs();
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  console.log('🎤 VoiceAgent component rendering - no Activity Log should be visible');

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Voice Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {!connected ? (
              <Button 
                onClick={connect} 
                disabled={connecting}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            ) : (
              <Button 
                onClick={disconnect} 
                variant="destructive"
                className="flex items-center gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                Disconnect
              </Button>
            )}
            
            {connected && (
              <Button
                onClick={toggleMic}
                variant={micEnabled ? "default" : "secondary"}
                className="flex items-center gap-2"
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                {micEnabled ? 'Mute' : 'Unmute'}
              </Button>
            )}

            <Button
              onClick={testConnections}
              disabled={testing}
              variant="outline"
              className="flex items-center gap-2"
            >
              {testing ? 'Testing...' : 'Test API'}
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about aircraft documentation..."
              disabled={!connected}
              className="flex-1"
            />
            <Button 
              onClick={handleAskDocs}
              disabled={!connected || !question.trim()}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Ask
            </Button>
          </div>

          {/* DEBUGGING: This should confirm no Activity Log is being rendered */}
          <div className="text-sm text-muted-foreground">
            Debug: VoiceAgent rendered at {new Date().toLocaleTimeString()} - No Activity Log present
          </div>
        </CardContent>
      </Card>
    </div>
  );
}