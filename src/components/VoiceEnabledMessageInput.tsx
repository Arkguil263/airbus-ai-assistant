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
  onSpeakingChange?: (isSpeaking: boolean) => void;
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
  onVoiceMessage,
  onSpeakingChange 
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
      // Create aircraft-specific voice instructions
      let instructions;
      if (aircraftModel === 'A320') {
        instructions = `You are a helpful voice agent for Tiger Airways aircraft documentation. 
          You have access to Tiger Airways manuals and technical documentation. 
          Keep replies concise and friendly. Please always answer the question, do not reply at the end that you have to check with Tiger Airways' specific policy. Focus on getting the answer on systems information, operating procedures, and Tiger Airways operations`;
      } else if (aircraftModel === 'A330') {
        instructions = `You are a helpful voice agent for A330 aircraft documentation. 
          You have access to A330 manuals and technical documentation. 
          Keep replies concise and friendly. Focus on A330-specific systems, procedures, and operations.
          You specialize in wide-body long-haul aircraft operations.`;
      } else if (aircraftModel === 'A350') {
        instructions = `You are a helpful voice agent for A350 aircraft documentation. 
          You have access to A350 manuals and technical documentation. 
          Keep replies concise and friendly. Focus on A350-specific systems, procedures, and operations.
          You specialize in next-generation wide-body aircraft with advanced avionics.`;
      } else if (aircraftModel === 'Briefing') {
        // Read cached briefing data from localStorage
        const cachedData = localStorage.getItem('briefing_cache');
        let briefingContext = '';
        
        if (cachedData) {
          try {
            const briefingCache = JSON.parse(cachedData);
            const isValid = Date.now() - briefingCache.timestamp < (24 * 60 * 60 * 1000); // 24 hours
            
            if (isValid && briefingCache.flightPlan && briefingCache.notamAnalysis) {
              // Combine and compress the cached data (keep under 6000 chars for efficiency)
              const combinedData = `${briefingCache.flightPlan}\n\n=== NOTAM ANALYSIS ===\n\n${briefingCache.notamAnalysis}`;
              briefingContext = combinedData.slice(0, 6000);
            }
          } catch (error) {
            console.error('Error reading cached briefing data:', error);
          }
        }
        
        instructions = `You are a helpful voice agent for flight briefing assistance. 
          You have access to cached flight briefing data and can answer questions about flight plans, NOTAMs, and operational details.
          Keep replies concise and friendly. Focus on the specific briefing information provided.
          
          SPECIAL INSTRUCTION: If the user asks for anything containing the word "briefing", respond with the following exact captain's briefing:
          
          "Good morning, everyone. Today's flight is Captain Peter, which is my creator.—that's me—First Officer Calvin, and we also have Check Pilot James on board with us. Please make sure you've got your passport/crew ID/licenses handy and that any required docs are in order. Thank you.
          
          Our flight time is about 2 hours and 14 minutes gate-to-gate. Departure weather shows intermittent low cloud improving, no thunderstorms expected for takeoff. En-route, we may need a few small deviations with light to moderate bumps at times. Arrival has a small thunderstorm risk, and we've carried extra fuel to cover holding or weather changes if needed.
          
          Communication & sterile cockpit: From door close to 10,000 feet, and again from 10,000 feet to the gate, we'll keep a sterile cockpit. Please use the interphone for safety or operational issues—address it to Captain Peter or the flight deck, and we'll respond right away.
          
          If we anticipate bumps, you'll get the seat belt sign on (twice) plus my PA. Please stop service, secure carts and galleys, check lavs if safe, then be seated with belts fastened. We'll update you as conditions improve.
          
          On-ground emergencies / RTO: If we reject the takeoff, listen for the PA: "Attention crew at stations, attention crew at stations" (twice). Stand by for instructions. If an evacuation is required, you will hear: "EVACUATE, EVACUATE, EVACUATE." Please assess outside conditions, follow your door procedures, and lead passengers as briefed.
          
          If something occurs in flight, I'll invite the CIC to the cockpit for a quick brief:
          * Nature of the issue,
          * Intentions (evacuate or not),
          * Time available, and
          * Signal
          * Special instructions, including the signal for evacuation if required. We'll keep everyone informed as we go.
          
          When calling the flight deck, please state your name, your intention, and today's password. The password is "Safe Flight." (Flight-use only; not over PA.)
          
          That's all from me—thank you for the teamwork. If you have any questions, now's the perfect time. Safe day, everyone."
          
          ${briefingContext ? `\n\nCached briefing context (user-provided):\n${briefingContext}` : '\n\nNo cached briefing data available. Ask the user to load briefing data first.'}`;
      } else {
        instructions = `You are a helpful voice agent for ${aircraftModel} aircraft documentation. 
          You have access to ${aircraftModel} manuals and technical documentation. 
          Keep replies concise and friendly. Focus on ${aircraftModel}-specific information when answering questions.`;
      }
        
      // Use aircraft-specific realtime session endpoint
      const sessionEndpoint = aircraftModel === 'A330' ? 'realtime-session-a330' : 
                              aircraftModel === 'A350' ? 'realtime-session-a350' : 
                              'realtime-session';
      const { data, error } = await supabase.functions.invoke(sessionEndpoint, {
        body: { 
          instructions,
          aircraftModel 
        }
      });

      if (error || !data?.client_secret?.value) {
        throw new Error(error?.message || 'Failed to establish voice connection');
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
      
      dc.onopen = () => {
        console.log('Data channel opened, sending session update with vector store');
        
        // Send session update with file search tools after connection is established
        const vectorStoreMapping = {
          'A320': 'vs_A320',
          'A330': 'vs_A330', 
          'A350': 'vs_A350',
          'Briefing': 'vs_Briefing'
        };
        
        const sessionUpdate = {
          type: 'session.update',
          session: {
            tools: [{ type: "file_search" }],
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStoreMapping[aircraftModel] || 'vs_default']
              }
            }
          }
        };
        
        console.log(`Updating session with vector store for ${aircraftModel}:`, sessionUpdate);
        dc.send(JSON.stringify(sessionUpdate));
      };
      
      dc.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data);
          console.log('WebRTC event received:', event.type, event);
          
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
              // Note: Don't stop speaking indicator here, wait for response.done
            }
          } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
            // Handle user speech transcription - add to main chat
            if (event.transcript && event.transcript.trim()) {
              console.log('User speech transcribed:', event.transcript);
              
              // Add user message to main chat
              onVoiceMessage?.({ 
                role: 'user', 
                content: event.transcript, 
                isVoice: true 
              });
              
              // Create conversation item and trigger response (using file search tools)
              const conversationItem = {
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: event.transcript
                    }
                  ]
                }
              };
              
              dc.send(JSON.stringify(conversationItem));
              dc.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ["audio", "text"]
                }
              }));
            }
          } else if (event.type === 'response.audio.delta') {
            // AI is speaking
            onSpeakingChange?.(true);
          } else if (event.type === 'response.created') {
            // Response started
            onSpeakingChange?.(true);
          } else if (event.type === 'response.done') {
            // Response completed
            onSpeakingChange?.(false);
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
      
      // Send initial greeting trigger after connection is established
      setTimeout(() => {
        if (dcRef.current?.readyState === 'open') {
          // For Briefing model, inject cached data into conversation if available
          if (aircraftModel === 'Briefing') {
            const cachedData = localStorage.getItem('briefing_cache');
            if (cachedData) {
              try {
                const briefingCache = JSON.parse(cachedData);
                const isValid = Date.now() - briefingCache.timestamp < (24 * 60 * 60 * 1000);
                
                if (isValid && briefingCache.flightPlan && briefingCache.notamAnalysis) {
                  // Add cached data as a user message in the conversation
                  const cachedDataEvent = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'message',
                      role: 'user',
                      content: [
                        {
                          type: 'input_text',
                          text: `Here is my cached briefing data:\n\n${briefingCache.flightPlan}\n\n=== NOTAM ANALYSIS ===\n\n${briefingCache.notamAnalysis}`
                        }
                      ]
                    }
                  };
                  dcRef.current.send(JSON.stringify(cachedDataEvent));
                }
              } catch (error) {
                console.error('Error sending cached briefing data:', error);
              }
            }
          }
          
          const greetingEvent = {
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'Hello'
                }
              ]
            }
          };
          dcRef.current.send(JSON.stringify(greetingEvent));
          dcRef.current.send(JSON.stringify({type: 'response.create'}));
        }
      }, 1000); // Wait 1 second to ensure connection is stable
      
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
    onSpeakingChange?.(false); // Reset speaking state when disconnecting
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
      const vectorSearchEndpoint = aircraftModel === 'A330' ? 'vector-search-a330' : 
                                   aircraftModel === 'A350' ? 'vector-search-a350' :
                                   'vector-search';
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
            className={`max-h-[120px] resize-none overflow-y-hidden py-3 leading-6 bg-background border-input focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 ${aircraftModel === 'Briefing' ? 'text-sm min-h-[32px]' : 'text-base min-h-[40px]'}`}
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