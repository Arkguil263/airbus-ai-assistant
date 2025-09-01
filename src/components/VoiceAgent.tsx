import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FileUpload from "./FileUpload";

export default function VoiceAgent() {
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [question, setQuestion] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [flightAnalysis, setFlightAnalysis] = useState<string>("");
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
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
      const instructions = flightAnalysis 
        ? `You are a helpful voice agent for aircraft documentation. You have access to a detailed flight analysis: ${flightAnalysis}. Use this analysis to answer questions about the flight plan, weather, and NOTAMs. Keep replies concise and friendly.`
        : "You are a helpful voice agent for aircraft documentation. Keep replies concise and friendly.";
        
      const { data, error } = await supabase.functions.invoke('realtime-session', {
        body: { 
          instructions 
        }
      });

      if (error || !data?.client_secret) {
        throw new Error(error?.message || 'Failed to mint ephemeral key');
      }

      const clientSecret = data.client_secret.value;

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
        try {
          const event = JSON.parse(evt.data);
          
          // Handle different event types
          if (event.type === 'response.audio_transcript.delta') {
            // Handle real-time transcript
            const newMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant' as const,
              content: event.delta || '',
              timestamp: new Date(),
            };
            setMessages(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.role === 'assistant' && 
                  Date.now() - lastMessage.timestamp.getTime() < 1000) {
                // Update the last assistant message
                return [...prev.slice(0, -1), {
                  ...lastMessage,
                  content: lastMessage.content + event.delta,
                  timestamp: new Date()
                }];
              } else {
                // Add new message
                return [...prev, newMessage];
              }
            });
          } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
            // Handle user speech transcription
            const userMessage = {
              id: `user-${Date.now()}`,
              role: 'user' as const,
              content: event.transcript || '',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, userMessage]);
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
      // 1) Get grounded answer from briefing vector store via backend
      const { data, error } = await supabase.functions.invoke('vector-search-briefing', {
        body: { question: questionText }
      });

      if (error) {
        throw new Error(error.message);
      }

      const answer = data?.answer || 'No answer found in briefing documentation.';

      // Add the assistant's response to the conversation
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // 2) If voice connection is active, also tell Realtime model to SPEAK this text
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
      }

    } catch (error) {
      console.error('Briefing search error:', error);
      toast({
        title: "Briefing Search Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  const handleAskDocs = () => {
    if (question.trim()) {
      // Add user message to conversation
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: question,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      
      askDocs(question);
      setQuestion("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskDocs();
    }
  };

  const handleAnalysisComplete = (analysis: string) => {
    setFlightAnalysis(analysis);
    toast({
      title: "Flight Analysis Ready",
      description: "Voice agent now has access to your flight data",
    });
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Conversation Display - Fixed height with scroll */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1 h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation with the voice agent</p>
                <p className="text-sm">Connect and speak, or type your questions below</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Controls at bottom */}
      <div className="border-t bg-background p-4 space-y-4">
        {/* File Upload */}
        <FileUpload onAnalysisComplete={handleAnalysisComplete} />

        {/* Question Input with Voice Agent Icon */}
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about flight briefings, weather, NOTAMs..."
            className="flex-1"
          />
          
          {/* Voice Agent Connect/Disconnect Button */}
          {!connected ? (
            <Button 
              onClick={connect} 
              disabled={connecting}
              variant="default"
              size="icon"
              className="h-10 w-10"
            >
              <Mic className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={toggleMic}
              variant={micEnabled ? "default" : "secondary"}
              size="icon"
              className="h-10 w-10"
            >
              {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
          )}

          {/* Ask Button */}
          <Button 
            onClick={handleAskDocs}
            disabled={!question.trim()}
            size="icon"
            className="h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Disconnect Button when connected */}
        {connected && (
          <div className="flex justify-center">
            <Button 
              onClick={disconnect} 
              variant="destructive"
              className="flex items-center gap-2"
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}