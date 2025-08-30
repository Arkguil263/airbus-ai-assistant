import { supabase } from '@/integrations/supabase/client';

export interface RealtimeSession {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  audioElement: HTMLAudioElement;
  disconnect: () => void;
}

export interface RealtimeOptions {
  model?: string;
  onTranscript?: (text: string) => void;
  onToolCall?: (toolCall: any) => Promise<any>;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export class RealtimeVoiceClient {
  private session: RealtimeSession | null = null;
  private transcriptBuffer = '';

  async connect(options: RealtimeOptions = {}): Promise<RealtimeSession> {
    try {
      console.log('Starting realtime voice connection...');
      
      // 1) Fetch ephemeral key from our edge function
      const { data, error } = await supabase.functions.invoke('ephemeral');
      
      if (error || !data?.ephemeralKey) {
        throw new Error(`Failed to get ephemeral key: ${error?.message || 'No key received'}`);
      }

      const ephemeralKey = data.ephemeralKey;
      console.log('Got ephemeral key, setting up WebRTC...');

      // 2) Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // 3) Create audio element for playback
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      // 4) Handle incoming audio stream
      pc.ontrack = (event) => {
        console.log('Received audio track from OpenAI');
        audioElement.srcObject = event.streams[0];
      };

      // 5) Add local microphone stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        }
      });

      mediaStream.getTracks().forEach(track => {
        pc.addTrack(track, mediaStream);
      });

      // 6) Create data channel for events
      const dc = pc.createDataChannel('oai-events');

      dc.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);

          // Handle transcript updates
          if (message.type === 'response.audio_transcript.delta') {
            this.transcriptBuffer += message.delta || '';
            options.onTranscript?.(this.transcriptBuffer);
          } else if (message.type === 'response.audio_transcript.done') {
            options.onTranscript?.(this.transcriptBuffer);
            this.transcriptBuffer = '';
          }

          // Handle tool calls
          if (message.type === 'response.function_call_arguments.done') {
            const { call_id, arguments: args } = message;
            const parsedArgs = JSON.parse(args || '{}');
            
            console.log('Tool call received:', { call_id, args: parsedArgs });

            try {
              // Call the existing chat-assistant function which handles document search
              const { data: searchResult, error: searchError } = await supabase.functions.invoke('chat-assistant', {
                body: {
                  messages: [
                    {
                      role: 'user',
                      content: parsedArgs.query || 'Search documents'
                    }
                  ],
                  searchOnly: true // Flag to indicate we only want search results
                }
              });

              if (searchError) {
                throw new Error(searchError.message);
              }

              // Send tool result back to OpenAI
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id,
                  output: JSON.stringify(searchResult)
                }
              }));

              console.log('Tool result sent back to OpenAI');
            } catch (error) {
              console.error('Tool call error:', error);
              dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id,
                  output: JSON.stringify({ error: String(error) })
                }
              }));
            }
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      };

      dc.onopen = () => {
        console.log('Data channel opened');
        options.onConnected?.();

        // Send session update with specific instructions
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: 'You are a concise, pilot-friendly voice assistant for Airbus aircraft. When users ask about aircraft systems, procedures, or technical information, use the searchDocs tool to find relevant documentation before responding. Keep responses clear and aviation-focused.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            }
          }
        }));
      };

      dc.onclose = () => {
        console.log('Data channel closed');
        options.onDisconnected?.();
      };

      // 7) Create offer and connect to OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const model = options.model || 'gpt-4o-realtime-preview-2024-12-17';
      console.log('Connecting to OpenAI Realtime API...');

      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
          'Accept': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        throw new Error(`Failed to connect to OpenAI: ${await sdpResponse.text()}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      console.log('WebRTC connection established with OpenAI');

      const disconnect = () => {
        console.log('Disconnecting realtime session...');
        dc.close();
        pc.close();
        mediaStream.getTracks().forEach(track => track.stop());
        if (audioElement.parentNode) {
          audioElement.parentNode.removeChild(audioElement);
        }
        this.session = null;
      };

      this.session = { pc, dc, audioElement, disconnect };
      return this.session;

    } catch (error) {
      console.error('Error connecting to realtime voice:', error);
      options.onError?.(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  disconnect() {
    if (this.session) {
      this.session.disconnect();
    }
  }

  isConnected(): boolean {
    return this.session !== null && this.session.pc.connectionState === 'connected';
  }

  mute() {
    if (this.session?.audioElement) {
      this.session.audioElement.muted = true;
    }
  }

  unmute() {
    if (this.session?.audioElement) {
      this.session.audioElement.muted = false;
    }
  }
}