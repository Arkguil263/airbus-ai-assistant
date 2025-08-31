import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Bot } from 'lucide-react';

interface TranscriptMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface VoiceTranscriptProps {
  messages: TranscriptMessage[];
  isVisible: boolean;
}

const VoiceTranscript: React.FC<VoiceTranscriptProps> = ({ messages, isVisible }) => {
  if (!isVisible || messages.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mic className="h-4 w-4" />
          Voice Conversation Transcript
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-32 w-full">
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-primary/10 text-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {message.type === 'user' ? (
                    <Mic className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs mb-1">
                    {message.type === 'user' ? 'You said:' : 'AI responded:'}
                  </div>
                  <div className="break-words">{message.content}</div>
                  <div className="text-xs opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default VoiceTranscript;